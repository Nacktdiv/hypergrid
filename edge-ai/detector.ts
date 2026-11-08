import {
  EDGE_AI_CONFIG,
  evaluateDetection,
  getConfidenceTier,
  validateRoadAnomaly,
} from './model-config';
import { extractFeatures, decomposeSensorSignals } from './feature-extractor';
import type {
  EdgeDetectionResult,
  SensorWindow,
  SensorFrame,
} from './types';
import { detectionsService } from '@/services/api/detections.service';
import { historyStorage } from '@/services/api/history-storage';
import { offlineQueue } from '@/services/api/offline-queue';
import type { CreateDetectionDto, RawDetection } from '@/types/api';

/**
 * Edge AI Road Damage Detector v2.
 *
 * Mendukung tiga tingkat inferensi dengan Strict Dual-Filter:
 *  A) Full TFLite (SensorWindow) — 47 fitur matematis + model Neural Network
 *  B) Smart Window Heuristic (SensorWindow) — Dekomposisi 3D EMA gravitasi,
 *     Crest Factor, dan rasio vertikal/horizontal saat model TFLite belum ready
 *  C) Calibrated Legacy Fallback (SensorFrame) — Ambang batas guncangan dinamis
 *     dengan validasi kecepatan minimum
 */
import { tokenStorage } from '@/services/api/token-storage';

export class EdgeRoadDamageDetector {
  private deviceId: string;
  private userId: string | null = null;

  constructor(deviceId?: string, userId?: string | null) {
    this.deviceId =
      deviceId || `${EDGE_AI_CONFIG.deviceIdPrefix}${Math.random().toString(36).substring(2, 9)}`;
    this.userId = userId || null;

    // Sinkronkan ke deviceId persisten
    tokenStorage.getDeviceId().then((id) => {
      this.deviceId = id;
    }).catch(() => {});
  }

  public setDeviceId(deviceId: string): void { this.deviceId = deviceId; }
  public setUserId(userId: string | null): void { this.userId = userId; }
  public getDeviceId(): string { return this.deviceId; }

  /**
   * Mode A: Inferensi LENGKAP dengan 47 fitur dari SensorWindow via TFLite.
   *
   * @param window  Buffer sampel sensor yang terkumpul selama ~1.5 detik
   * @param predict Fungsi prediksi dari useTfliteModel()
   */
  public async inferWindow(
    window: SensorWindow,
    predict: (features: Float32Array) => Promise<{
      isPothole: boolean;
      probability: number;
      confidence: number;
      confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW';
    }>,
    vehicleConfig?: {
      vehicleType?: string;
      zShockThreshold?: number;
      minMovingSpeed?: number;
      severityThresholds?: { severe: number; high: number; medium: number };
    }
  ): Promise<EdgeDetectionResult> {
    const { samples, latitude, longitude, timestamp } = window;

    if (samples.length < EDGE_AI_CONFIG.minSamplesForInference) {
      return this._notAnomaly(samples, latitude, longitude);
    }

    const speedKmh =
      samples.length > 0
        ? samples.reduce((s, c) => s + c.speedKmh, 0) / samples.length
        : 0;

    // Filter fisis: Jika kendaraan diam/hampir berhenti (< 5 km/h), abaikan
    if (speedKmh < 5.0) {
      return this._notAnomaly(samples, latitude, longitude);
    }

    // Dekomposisi sinyal vertikal dinamis untuk verifikasi fisik
    const decomposed = decomposeSensorSignals(samples);
    const vertSignals =
      decomposed.vertDynHpf.length > 0
        ? decomposed.vertDynHpf
        : decomposed.vertDyn;
    const maxVertDyn =
      vertSignals.length > 0 ? Math.max(...vertSignals) : 0;

    // Filter validasi fisik anomali jalan (tolak HP jatuh, diutak-atik, guncangan liar gyro)
    const validation = validateRoadAnomaly(samples, vertSignals);
    if (!validation.isValid) {
      return this._notAnomaly(samples, latitude, longitude);
    }

    // Ekstraksi 47 fitur dari window (identik dengan model training V2)
    const features = extractFeatures(samples);

    // Jalankan inferensi TFLite
    const { isPothole, probability, confidence, confidenceTier } =
      await predict(features);

    // Evaluasi Strict Dual-Filter (Tahap 1: Validasi False Positive, Tahap 2: Severity Fisik Adaptif Kendaraan)
    const evaluation = evaluateDetection({
      confidence,
      zAccelPeak: maxVertDyn,
      speedKmh,
      vehicleType: vehicleConfig?.vehicleType,
      vehicleThresholds: vehicleConfig?.severityThresholds,
    });

    // Filter sanity check: model harus memprediksi pothole, tidak ditolak filter, dan ada hentakan fisik nyata (>= 0.6G)
    if (!isPothole || evaluation.isRejected || maxVertDyn < 0.6) {
      return {
        isAnomalyDetected: false,
        anomalyType: 'normal',
        estimatedSeverity: 'low',
        probability: 0,
        confidence: 0,
        confidenceTier: 'LOW',
        zAccelPeak: 0,
        modelVersion: EDGE_AI_CONFIG.modelVersion,
        validationStatus: evaluation.status,
      };
    }

    // Severity dihitung murni dari hentakan fisik (zAccelPeak), BUKAN dari probability (p)
    const severity = evaluation.severity;

    const detectionDto: CreateDetectionDto = {
      deviceId: this.deviceId,
      userId: this.userId,
      latitude,
      longitude,
      confidence,
      speedKmh: Math.round(speedKmh * 10) / 10,
      zAccelPeak: Math.round(maxVertDyn * 100) / 100,
      modelVersion: EDGE_AI_CONFIG.modelVersion,
      detectedAt: timestamp,
    };

    // Hanya ditandai valid aktif seketika jika CONFIRMED atau CONFIRMED_VIA_SENSOR.
    // Jika UNCERTAIN, tetap dikirim ke DTO/queue untuk konfirmasi DBSCAN, tapi bukan alert tunggal.
    const isSingleConfirmed = evaluation.isValidPothole;

    return {
      isAnomalyDetected: isSingleConfirmed,
      anomalyType: 'pothole',
      estimatedSeverity: severity,
      probability,
      confidence,
      confidenceTier,
      zAccelPeak: maxVertDyn,
      modelVersion: EDGE_AI_CONFIG.modelVersion,
      detectionDto,
      validationStatus: evaluation.status,
    };
  }

  /**
   * Mode B: Smart Window Heuristic Detector.
   * Digunakan saat TFLite native module belum siap (misal di Expo Go).
   *
   * Menggunakan analisis bentuk gelombang window (bukan 1 titik instan):
   * 1. Dekomposisi vektor 3D dengan Causal EMA Gravity Removal & HPF (invarian orientasi HP).
   * 2. Validasi Kecepatan Minimal (Speed Gate: kendaraan harus bergerak).
   * 3. Penolakan Artefak Non-Jalan (HP jatuh, terlempar, atau disentuh kasar).
   * 4. Validasi Puncak Guncangan Vertikal Murni (di atas gravitasi 1G).
   * 5. Validasi Crest Factor (puncak tajam vs getaran rata-rata jalan/mesin).
   * 6. Validasi Dominansi Vertikal (memisahkan lubang dari tikungan/pengereman keras).
   * 7. Kalibrasi Keparahan Berdasarkan Kecepatan Fisis Kendaraan.
   */
  public inferWindowHeuristic(
    window: SensorWindow,
    config?: {
      vehicleType?: string;
      zShockThreshold?: number;
      minMovingSpeed?: number;
      severityThresholds?: { severe: number; high: number; medium: number };
    }
  ): EdgeDetectionResult {
    const { samples, latitude, longitude, timestamp } = window;

    if (samples.length < 3) {
      return this._notAnomaly(samples, latitude, longitude);
    }

    const speedAvg =
      samples.reduce((s, c) => s + c.speedKmh, 0) / samples.length;
    const minSpeed =
      config?.minMovingSpeed ?? EDGE_AI_CONFIG.minDetectionSpeedKmh;

    // 1. Speed Gate: Jika berhenti / terlalu lambat, bukan lubang jalan
    if (speedAvg < minSpeed) {
      return this._notAnomaly(samples, latitude, longitude);
    }

    // 2. Dekomposisi gaya vertikal & horizontal dipadu High-Pass Filter (HPF)
    const decomposed = decomposeSensorSignals(samples);
    const vertSignals =
      decomposed.vertDynHpf.length > 0
        ? decomposed.vertDynHpf
        : decomposed.vertDyn;

    // 3. Validasi fisik anomali: Tolak lonjakan ekstrem non-jalan, gyro tumbling & glitch
    const validation = validateRoadAnomaly(samples, vertSignals, {
      minMovingSpeed: minSpeed,
      zShockThreshold: config?.zShockThreshold,
    });
    if (!validation.isValid) {
      return this._notAnomaly(samples, latitude, longitude);
    }

    const maxVertDyn = Math.max(...vertSignals);
    const maxHorizDyn = Math.max(...decomposed.horizDyn);

    const rmsVertDyn = Math.sqrt(
      vertSignals.reduce((s, v) => s + v * v, 0) / samples.length
    );
    const crestFactor = maxVertDyn / (rmsVertDyn + 1e-6);

    const threshold =
      config?.zShockThreshold ?? EDGE_AI_CONFIG.defaultShockThresholdG;

    // 4. Evaluasi kondisi komprehensif
    const isShockSignificant = maxVertDyn >= threshold;
    const isSharpImpulse = crestFactor >= 1.55; // Puncak tunggal tajam, bukan dengung getaran rata
    const isVerticalDominant = maxVertDyn >= maxHorizDyn * 0.55; // Bukan belokan tajam / rem

    const isAnomaly =
      isShockSignificant && isSharpImpulse && isVerticalDominant;

    if (!isAnomaly) {
      return {
        isAnomalyDetected: false,
        anomalyType: 'normal',
        estimatedSeverity: 'low',
        probability: 0,
        confidence: 0,
        confidenceTier: 'LOW',
        zAccelPeak: 0,
        modelVersion: `${EDGE_AI_CONFIG.modelVersion}-heuristic`,
      };
    }

    // Hitung probabilitas proporsional terhadap kekuatan hentakan dan ketajaman
    const excess = Math.max(0, maxVertDyn - threshold);
    const probability = Math.min(
      0.96,
      Math.max(
        0.55,
        0.52 + (excess / (threshold * 1.2)) * 0.35 + (crestFactor - 1.55) * 0.04
      )
    );

    const { confidenceScore, confidenceTier } = getConfidenceTier(probability);

    // Evaluasi Strict Dual-Filter (Adaptif Kendaraan)
    const evaluation = evaluateDetection({
      confidence: confidenceScore,
      zAccelPeak: maxVertDyn,
      speedKmh: speedAvg,
      vehicleType: config?.vehicleType,
      vehicleThresholds: config?.severityThresholds,
    });

    if (evaluation.isRejected) {
      return {
        isAnomalyDetected: false,
        anomalyType: 'normal',
        estimatedSeverity: 'low',
        probability: 0,
        confidence: 0,
        confidenceTier: 'LOW',
        zAccelPeak: 0,
        modelVersion: `${EDGE_AI_CONFIG.modelVersion}-heuristic`,
        validationStatus: evaluation.status,
      };
    }

    // Severity murni dari hentakan fisik zAccelPeak
    const severity = evaluation.severity;

    const detectionDto: CreateDetectionDto = {
      deviceId: this.deviceId,
      userId: this.userId,
      latitude,
      longitude,
      confidence: confidenceScore,
      speedKmh: Math.round(speedAvg * 10) / 10,
      zAccelPeak: Math.round(maxVertDyn * 100) / 100,
      modelVersion: `${EDGE_AI_CONFIG.modelVersion}-heuristic`,
      detectedAt: timestamp,
    };

    return {
      isAnomalyDetected: evaluation.isValidPothole,
      anomalyType: 'pothole',
      estimatedSeverity: severity,
      probability,
      confidence: confidenceScore,
      confidenceTier,
      zAccelPeak: maxVertDyn,
      modelVersion: `${EDGE_AI_CONFIG.modelVersion}-heuristic`,
      detectionDto,
      validationStatus: evaluation.status,
    };
  }

  /**
   * Mode C: Fallback frame tunggal terkalibrasi (backward compatibility).
   * Mencegah false positive dari getaran kecil saat hanya 1 frame yang tersedia.
   */
  public inferLegacy(
    frame: SensorFrame,
    vehicleConfig?: {
      vehicleType?: string;
      zShockThreshold?: number;
      minMovingSpeed?: number;
      severityThresholds?: { severe: number; high: number; medium: number };
    }
  ): EdgeDetectionResult {
    // 1. Kecepatan minimal
    if (frame.speedKmh != null && frame.speedKmh < (vehicleConfig?.minMovingSpeed ?? 8.0)) {
      return this._notAnomaly([], frame.latitude, frame.longitude);
    }

    const rawZ = Math.abs(frame.zAccel);
    // Jika rawZ disuplai sebagai totalG (sekitar 1G gravitasi), kurangi baseline gravitasi
    const dynamicZ = rawZ >= 1.8 ? rawZ - 1.0 : rawZ;

    // Filter lonjakan ekstrem non-jalan (HP jatuh/terlempar)
    if (dynamicZ > EDGE_AI_CONFIG.maxExtremeSpikeG) {
      return this._notAnomaly([], frame.latitude, frame.longitude);
    }

    const shockThresh = vehicleConfig?.zShockThreshold ?? 1.10;
    // Hanya picu anomali jika deviasi guncangan dinamis murni >= shockThresh
    const isAnomaly = dynamicZ >= shockThresh;

    if (!isAnomaly) {
      return {
        isAnomalyDetected: false,
        anomalyType: 'normal',
        estimatedSeverity: 'low',
        probability: 0,
        confidence: 0,
        confidenceTier: 'LOW',
        zAccelPeak: dynamicZ,
        modelVersion: `${EDGE_AI_CONFIG.modelVersion}-fallback`,
      };
    }

    const probability = Math.min(
      1.0,
      Math.max(0.5, ((dynamicZ - shockThresh) / 2.0) * 0.5 + 0.5)
    );
    const { confidenceScore, confidenceTier } = getConfidenceTier(probability);

    // Evaluasi Strict Dual-Filter (Adaptif Kendaraan)
    const evaluation = evaluateDetection({
      confidence: confidenceScore,
      zAccelPeak: dynamicZ,
      speedKmh: frame.speedKmh,
      vehicleType: vehicleConfig?.vehicleType,
      vehicleThresholds: vehicleConfig?.severityThresholds,
    });

    if (evaluation.isRejected) {
      return {
        isAnomalyDetected: false,
        anomalyType: 'normal',
        estimatedSeverity: 'low',
        probability: 0,
        confidence: 0,
        confidenceTier: 'LOW',
        zAccelPeak: dynamicZ,
        modelVersion: `${EDGE_AI_CONFIG.modelVersion}-fallback`,
        validationStatus: evaluation.status,
      };
    }

    const severity = evaluation.severity;

    const detectionDto: CreateDetectionDto = {
      deviceId: this.deviceId,
      userId: this.userId,
      latitude: frame.latitude,
      longitude: frame.longitude,
      confidence: confidenceScore,
      speedKmh:
        frame.speedKmh != null ? Math.round(frame.speedKmh * 10) / 10 : undefined,
      zAccelPeak: Math.round(dynamicZ * 100) / 100,
      modelVersion: `${EDGE_AI_CONFIG.modelVersion}-fallback`,
      detectedAt: frame.timestamp || new Date().toISOString(),
    };

    return {
      isAnomalyDetected: evaluation.isValidPothole,
      anomalyType: 'pothole',
      estimatedSeverity: severity,
      probability,
      confidence: confidenceScore,
      confidenceTier,
      zAccelPeak: dynamicZ,
      modelVersion: `${EDGE_AI_CONFIG.modelVersion}-fallback`,
      detectionDto,
      validationStatus: evaluation.status,
    };
  }

  /** Proses dan kirim hasil deteksi ke backend atau offline queue + simpan ke historyStorage */
  public async processAndIngest(
    result: EdgeDetectionResult,
    options?: { offlineOnly?: boolean }
  ): Promise<void> {
    if (!result.detectionDto) return;
    // Hanya anomali valid terkonfirmasi atau data UNCERTAIN (untuk konfirmasi DBSCAN) yang diunggah
    if (!result.isAnomalyDetected && result.validationStatus !== 'UNCERTAIN') return;

    const dto = result.detectionDto;
    const localRecord: RawDetection = {
      id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      deviceId: dto.deviceId,
      userId: dto.userId ?? this.userId ?? null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      confidence: dto.confidence,
      speedKmh: dto.speedKmh ?? null,
      zAccelPeak: dto.zAccelPeak ?? null,
      modelVersion: dto.modelVersion ?? EDGE_AI_CONFIG.modelVersion,
      detectedAt: dto.detectedAt || new Date().toISOString(),
      createdAt: dto.detectedAt || new Date().toISOString(),
    };

    // Simpan instan ke RAM + AsyncStorage agar langsung tersedia di History
    historyStorage.addSingleDetection(localRecord).catch(() => {});

    if (options?.offlineOnly) {
      offlineQueue.enqueue(dto);
      return;
    }

    try {
      const created = await detectionsService.createDetection(dto);
      if (created && created.id) {
        historyStorage.addSingleDetection(created).catch(() => {});
      }
    } catch (error) {
      console.warn('[EdgeAI] Gagal kirim ke server, masuk offline queue:', error);
      offlineQueue.enqueue(dto);
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private _notAnomaly(
    samples: { az?: number }[],
    lat: number,
    lon: number
  ): EdgeDetectionResult {
    return {
      isAnomalyDetected: false,
      anomalyType: 'normal',
      estimatedSeverity: 'low',
      probability: 0,
      confidence: 0,
      confidenceTier: 'LOW',
      zAccelPeak: 0,
      modelVersion: EDGE_AI_CONFIG.modelVersion,
    };
  }
}

export const defaultEdgeDetector = new EdgeRoadDamageDetector();
