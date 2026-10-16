import {
  EDGE_AI_CONFIG,
  classifySeverityFromProbability,
  classifySeverityFromZPeak,
  getConfidenceTier,
} from './model-config';
import { extractFeatures } from './feature-extractor';
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
 * Mendukung dua mode inferensi:
 *  A) Full TFLite (SensorWindow) — ekstraksi 47 fitur + inferensi model nyata
 *  B) Legacy Z-peak fallback (SensorFrame) — digunakan saat model belum siap
 *
 * Gunakan `inferWindow()` dari `use-edge-ai.ts` yang mengumpulkan window sensor.
 */
export class EdgeRoadDamageDetector {
  private deviceId: string;
  private userId: string | null = null;

  constructor(deviceId?: string, userId?: string | null) {
    this.deviceId =
      deviceId || `${EDGE_AI_CONFIG.deviceIdPrefix}${Math.random().toString(36).substring(2, 9)}`;
    this.userId = userId || null;
  }

  public setDeviceId(deviceId: string): void { this.deviceId = deviceId; }
  public setUserId(userId: string | null): void { this.userId = userId; }
  public getDeviceId(): string { return this.deviceId; }

  /**
   * Inferensi LENGKAP dengan 47 fitur dari SensorWindow.
   * Membutuhkan prediksi dari useTfliteModel().predict() yang sudah di-call
   * dari layer hook (karena hook React tidak bisa dipanggil dari class non-React).
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

    // Hitung Z-peak dari sinyal untuk severity fallback
    const azValues = samples.map(s => Math.abs(s.az));
    const zPeak = Math.max(...azValues);

    // Ekstraksi 47 fitur dari window
    const features = extractFeatures(samples);

    // Jalankan inferensi TFLite
    const { isPothole, probability, confidence, confidenceTier } = await predict(features);

    if (!isPothole) {
      return {
        isAnomalyDetected: false,
        anomalyType: 'normal',
        estimatedSeverity: 'low',
        probability,
        confidence,
        confidenceTier,
        zAccelPeak: zPeak,
        modelVersion: EDGE_AI_CONFIG.modelVersion,
      };
    }

    const severity = classifySeverityFromProbability(probability);
    const speedKmh = samples.length > 0
      ? samples.reduce((s, c) => s + c.speedKmh, 0) / samples.length
      : 0;

    const detectionDto: CreateDetectionDto = {
      deviceId: this.deviceId,
      userId: this.userId,
      latitude,
      longitude,
      confidence,
      speedKmh: Math.round(speedKmh * 10) / 10,
      zAccelPeak: Math.round(zPeak * 100) / 100,
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
      zAccelPeak: zPeak,
      modelVersion: EDGE_AI_CONFIG.modelVersion,
      detectionDto,
    };
  }

  /**
   * Fallback legacy: inferensi berbasis Z-peak tunggal (tanpa TFLite).
   * Dipakai saat model sedang dimuat atau pada perangkat tidak kompatibel.
   */
  public inferLegacy(frame: SensorFrame): EdgeDetectionResult {
    const zPeak = Math.abs(frame.zAccel);
    const isAnomaly = zPeak >= 1.8;

    if (!isAnomaly) {
      return {
        isAnomalyDetected: false,
        anomalyType: 'normal',
        estimatedSeverity: 'low',
        probability: 0,
        confidence: 0,
        confidenceTier: 'LOW',
        zAccelPeak: zPeak,
        modelVersion: `${EDGE_AI_CONFIG.modelVersion}-fallback`,
      };
    }

    // Gunakan Z-peak untuk estimasi probabilitas kasar (linear mapping 1.8G→0.5, 4.0G→1.0)
    const probability = Math.min(1.0, Math.max(0.5, (zPeak - 1.8) / 2.2 * 0.5 + 0.5));
    const { confidenceScore, confidenceTier } = getConfidenceTier(probability);
    const severity = classifySeverityFromZPeak(zPeak);

    const detectionDto: CreateDetectionDto = {
      deviceId: this.deviceId,
      userId: this.userId,
      latitude: frame.latitude,
      longitude: frame.longitude,
      confidence: confidenceScore,
      speedKmh: frame.speedKmh != null ? Math.round(frame.speedKmh * 10) / 10 : undefined,
      zAccelPeak: Math.round(zPeak * 100) / 100,
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
      zAccelPeak: zPeak,
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
    samples: { az: number }[],
    lat: number,
    lon: number
  ): EdgeDetectionResult {
    const azValues = samples.map(s => Math.abs(s.az));
    const zPeak = azValues.length > 0 ? Math.max(...azValues) : 0;
    return {
      isAnomalyDetected: false,
      anomalyType: 'normal',
      estimatedSeverity: 'low',
      probability: 0,
      confidence: 0,
      confidenceTier: 'LOW',
      zAccelPeak: zPeak,
      modelVersion: EDGE_AI_CONFIG.modelVersion,
    };
  }
}

export const defaultEdgeDetector = new EdgeRoadDamageDetector();
