import {
  EDGE_AI_CONFIG,
  classifySeverityFromProbability,
  classifySeverityFromZPeak,
  getConfidenceTier,
} from './model-config';
import { extractFeatures, decomposeSensorSignals } from './feature-extractor';
import type {
  EdgeDetectionResult,
  SensorWindow,
  SensorFrame,
} from './types';
import { detectionsService } from '@/services/api/detections.service';
import { offlineQueue } from '@/services/api/offline-queue';
import type { CreateDetectionDto } from '@/types/api';

/**
 * Edge AI Road Damage Detector v2.
 *
 * Mendukung tiga tingkat inferensi:
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
    }>
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
    const maxVertDyn =
      decomposed.vertDyn.length > 0 ? Math.max(...decomposed.vertDyn) : 0;

    // Ekstraksi 47 fitur dari window (identik dengan model training V2)
    const features = extractFeatures(samples);

    // Jalankan inferensi TFLite
    const { isPothole, probability, confidence, confidenceTier } =
      await predict(features);

    // Filter sanity check: model memprediksi pothole dan memang ada lonjakan fisik nyata
    if (!isPothole || maxVertDyn < 0.6) {
      return {
        isAnomalyDetected: false,
        anomalyType: 'normal',
        estimatedSeverity: 'low',
        probability,
        confidence,
        confidenceTier,
        zAccelPeak: maxVertDyn,
        modelVersion: EDGE_AI_CONFIG.modelVersion,
      };
    }

    const severity = classifySeverityFromProbability(probability);

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

    return {
      isAnomalyDetected: true,
      anomalyType: 'pothole',
      estimatedSeverity: severity,
      probability,
      confidence,
      confidenceTier,
      zAccelPeak: maxVertDyn,
      modelVersion: EDGE_AI_CONFIG.modelVersion,
      detectionDto,
    };
  }

  /**
   * Mode B: Smart Window Heuristic Detector.
   * Digunakan saat TFLite native module belum siap (misal di Expo Go).
   *
   * Menggunakan analisis bentuk gelombang window (bukan 1 titik instan):
   * 1. Dekomposisi vektor 3D dengan Causal EMA Gravity Removal (invarian orientasi HP).
   * 2. Validasi Kecepatan Minimal (Speed Gate: kendaraan harus bergerak).
   * 3. Validasi Puncak Guncangan Vertikal Murni (di atas gravitasi 1G).
   * 4. Validasi Crest Factor (puncak tajam vs getaran rata-rata jalan/mesin).
   * 5. Validasi Dominansi Vertikal (memisahkan lubang dari tikungan/pengereman keras).
   */
  public inferWindowHeuristic(
    window: SensorWindow,
    config?: {
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

    // 2. Dekomposisi gaya vertikal & horizontal
    const decomposed = decomposeSensorSignals(samples);
    const maxVertDyn = Math.max(...decomposed.vertDyn);
    const maxHorizDyn = Math.max(...decomposed.horizDyn);

    const rmsVertDyn = Math.sqrt(
      decomposed.vertDyn.reduce((s, v) => s + v * v, 0) / samples.length
    );
    const crestFactor = maxVertDyn / (rmsVertDyn + 1e-6);

    const threshold =
      config?.zShockThreshold ?? EDGE_AI_CONFIG.defaultShockThresholdG;

    // 3. Evaluasi kondisi komprehensif
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
        probability: 0.15,
        confidence: 0.85,
        confidenceTier: 'HIGH',
        zAccelPeak: maxVertDyn,
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
    const severity = classifySeverityFromZPeak(
      maxVertDyn,
      config?.severityThresholds
    );

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
      isAnomalyDetected: true,
      anomalyType: 'pothole',
      estimatedSeverity: severity,
      probability,
      confidence: confidenceScore,
      confidenceTier,
      zAccelPeak: maxVertDyn,
      modelVersion: `${EDGE_AI_CONFIG.modelVersion}-heuristic`,
      detectionDto,
    };
  }

  /**
   * Mode C: Fallback frame tunggal terkalibrasi (backward compatibility).
   * Mencegah false positive dari getaran kecil saat hanya 1 frame yang tersedia.
   */
  public inferLegacy(frame: SensorFrame): EdgeDetectionResult {
    // 1. Kecepatan minimal
    if (frame.speedKmh != null && frame.speedKmh < 8.0) {
      return this._notAnomaly([], frame.latitude, frame.longitude);
    }

    const rawZ = Math.abs(frame.zAccel);
    // Jika rawZ disuplai sebagai totalG (sekitar 1G gravitasi), kurangi baseline gravitasi
    const dynamicZ = rawZ >= 1.8 ? rawZ - 1.0 : rawZ;

    // Hanya picu anomali jika deviasi guncangan dinamis murni >= 1.10G
    const isAnomaly = dynamicZ >= 1.10;

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
      Math.max(0.5, ((dynamicZ - 1.1) / 2.0) * 0.5 + 0.5)
    );
    const { confidenceScore, confidenceTier } = getConfidenceTier(probability);
    const severity = classifySeverityFromZPeak(dynamicZ);

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
      isAnomalyDetected: true,
      anomalyType: 'pothole',
      estimatedSeverity: severity,
      probability,
      confidence: confidenceScore,
      confidenceTier,
      zAccelPeak: dynamicZ,
      modelVersion: `${EDGE_AI_CONFIG.modelVersion}-fallback`,
      detectionDto,
    };
  }

  /** Proses dan kirim hasil deteksi ke backend atau offline queue */
  public async processAndIngest(
    result: EdgeDetectionResult,
    options?: { offlineOnly?: boolean }
  ): Promise<void> {
    if (!result.isAnomalyDetected || !result.detectionDto) return;

    if (options?.offlineOnly) {
      offlineQueue.enqueue(result.detectionDto);
      return;
    }

    try {
      await detectionsService.createDetection(result.detectionDto);
    } catch (error) {
      console.warn('[EdgeAI] Gagal kirim ke server, masuk offline queue:', error);
      offlineQueue.enqueue(result.detectionDto);
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
      probability: 0.05,
      confidence: 0.95,
      confidenceTier: 'HIGH',
      zAccelPeak: 0,
      modelVersion: EDGE_AI_CONFIG.modelVersion,
    };
  }
}

export const defaultEdgeDetector = new EdgeRoadDamageDetector();
