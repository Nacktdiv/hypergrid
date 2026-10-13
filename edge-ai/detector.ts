import {
  EDGE_AI_CONFIG,
  classifySeverityFromZPeak,
  generateDummyConfidence,
} from './model-config';
import type { EdgeDetectionResult, SensorFrame } from './types';
import { detectionsService } from '@/services/api/detections.service';
import { offlineQueue } from '@/services/api/offline-queue';
import type { CreateDetectionDto } from '@/types/api';

/**
 * Edge AI Road Damage Detector.
 * Berjalan langsung di perangkat mobile untuk mendeteksi guncangan dan kerusakan jalan (edge computing).
 * Pada fase awal, skor confidence menggunakan nilai dummy terkalibrasi untuk pengujian integrasi.
 */
export class EdgeRoadDamageDetector {
  private deviceId: string;
  private userId: string | null = null;

  constructor(deviceId?: string, userId?: string | null) {
    this.deviceId =
      deviceId || `${EDGE_AI_CONFIG.deviceIdPrefix}${Math.random().toString(36).substring(2, 9)}`;
    this.userId = userId || null;
  }

  public setDeviceId(deviceId: string): void {
    this.deviceId = deviceId;
  }

  public setUserId(userId: string | null): void {
    this.userId = userId;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * Menjalankan inferensi Edge AI pada data sensor frame
   */
  public infer(frame: SensorFrame): EdgeDetectionResult {
    const zPeak = Math.abs(frame.zAccel);
    const isAnomaly = zPeak >= EDGE_AI_CONFIG.thresholds.low;

    if (!isAnomaly) {
      return {
        isAnomalyDetected: false,
        anomalyType: 'normal',
        estimatedSeverity: 'low',
        confidence: 0,
        zAccelPeak: zPeak,
        modelVersion: EDGE_AI_CONFIG.modelVersion,
      };
    }

    // Menghasilkan dummy confidence untuk tahap pengujian awal (misal: 0.88 - 0.96)
    const confidence = generateDummyConfidence();
    const severity = classifySeverityFromZPeak(zPeak);

    const detectionDto: CreateDetectionDto = {
      deviceId: this.deviceId,
      userId: this.userId,
      latitude: frame.latitude,
      longitude: frame.longitude,
      confidence,
      speedKmh: frame.speedKmh ? Math.round(frame.speedKmh * 10) / 10 : undefined,
      zAccelPeak: Math.round(zPeak * 100) / 100,
      modelVersion: EDGE_AI_CONFIG.modelVersion,
      detectedAt: frame.timestamp || new Date().toISOString(),
    };

    return {
      isAnomalyDetected: true,
      anomalyType: 'pothole',
      estimatedSeverity: severity,
      confidence,
      zAccelPeak: zPeak,
      modelVersion: EDGE_AI_CONFIG.modelVersion,
      detectionDto,
    };
  }

  /**
   * Proses dan kirim langsung ke backend (Online), atau antrekan ke Offline Queue jika offline
   */
  public async processAndIngest(
    frame: SensorFrame,
    options?: { offlineOnly?: boolean }
  ): Promise<EdgeDetectionResult> {
    const result = this.infer(frame);

    if (result.isAnomalyDetected && result.detectionDto) {
      if (options?.offlineOnly) {
        offlineQueue.enqueue(result.detectionDto);
      } else {
        try {
          await detectionsService.createDetection(result.detectionDto);
        } catch (error) {
          // Fallback otomatis ke antrean offline jika koneksi gagal
          console.warn(
            '[EdgeAI] Gagal mengirim langsung, memasukkan ke antrean offline:',
            error
          );
          offlineQueue.enqueue(result.detectionDto);
        }
      }
    }

    return result;
  }
}

export const defaultEdgeDetector = new EdgeRoadDamageDetector();
