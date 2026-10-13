import type { CreateDetectionDto, PotholeSeverity } from '@/types/api';
export type { CreateDetectionDto, PotholeSeverity };

export type RoadAnomalyType = 'pothole' | 'bump' | 'crack' | 'normal';

export interface SensorFrame {
  /** Nilai akselerometer sumbu Z (gravitasi / guncangan vertikal) */
  zAccel: number;
  /** Nilai akselerometer sumbu X */
  xAccel?: number;
  /** Nilai akselerometer sumbu Y */
  yAccel?: number;
  /** Koordinat GPS saat ini */
  latitude: number;
  longitude: number;
  /** Kecepatan kendaraan saat ini (km/jam) */
  speedKmh?: number;
  /** Waktu pengambilan sensor */
  timestamp?: string;
}

export interface EdgeDetectionResult {
  /** Apakah terdeteksi anomali/kerusakan jalan */
  isAnomalyDetected: boolean;
  /** Tipe anomali yang terdeteksi oleh Edge AI */
  anomalyType: RoadAnomalyType;
  /** Estimasi tingkat keparahan */
  estimatedSeverity: PotholeSeverity;
  /** Nilai keyakinan (Confidence Score) Edge AI (0.0 - 1.0) - dummy untuk tahap testing */
  confidence: number;
  /** Puncak akselerasi Z (dalam G) */
  zAccelPeak: number;
  /** Versi model inferensi edge AI */
  modelVersion: string;
  /** Payload DTO yang siap dikirim ke backend HyperGrid */
  detectionDto?: CreateDetectionDto;
}
