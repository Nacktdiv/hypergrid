import type { CreateDetectionDto, PotholeSeverity } from '@/types/api';
export type { CreateDetectionDto, PotholeSeverity };

export type RoadAnomalyType = 'pothole' | 'bump' | 'crack' | 'normal';

/** Satu sampel sensor mentah dari accelerometer + gyroscope pada satu titik waktu */
export interface RawSensorSample {
  /** Accelerometer X (lateral) */
  ax: number;
  /** Accelerometer Y (longitudinal) */
  ay: number;
  /** Accelerometer Z (vertikal — guncangan jalan) */
  az: number;
  /** Gyroscope X (pitch rate) */
  gx: number;
  /** Gyroscope Y (roll rate) */
  gy: number;
  /** Gyroscope Z (yaw rate) */
  gz: number;
  /** Kecepatan GPS (km/h) pada saat sampel diambil */
  speedKmh: number;
  /** Timestamp epoch ms */
  timestampMs: number;
}

/** Window buffer berisi N sampel mentah sensor untuk diekstraksi ke 47 fitur */
export interface SensorWindow {
  samples: RawSensorSample[];
  latitude: number;
  longitude: number;
  timestamp: string;
}

/** Frame sensor ringkas (backward compat untuk processFrame) */
export interface SensorFrame {
  /** Nilai akselerometer sumbu Z (vertikal) */
  zAccel: number;
  /** Nilai akselerometer sumbu X */
  xAccel?: number;
  /** Nilai akselerometer sumbu Y */
  yAccel?: number;
  /** Gyroscope X */
  gyrX?: number;
  /** Gyroscope Y */
  gyrY?: number;
  /** Gyroscope Z */
  gyrZ?: number;
  /** Koordinat GPS saat ini */
  latitude: number;
  longitude: number;
  /** Kecepatan kendaraan saat ini (km/jam) */
  speedKmh?: number;
  /** Waktu pengambilan sensor */
  timestamp?: string;
}

/** Hasil lengkap inferensi Edge AI (47-fitur TFLite v2) */
export interface EdgeDetectionResult {
  /** Apakah terdeteksi anomali/kerusakan jalan */
  isAnomalyDetected: boolean;
  /** Tipe anomali yang terdeteksi */
  anomalyType: RoadAnomalyType;
  /** Estimasi tingkat keparahan */
  estimatedSeverity: PotholeSeverity;
  /** Probabilitas pothole mentah dari output model (0–1) */
  probability: number;
  /** Skor keyakinan model terhadap keputusan (0–1) */
  confidence: number;
  /** Tingkatan keyakinan: HIGH ≥ 0.80, MEDIUM ≥ 0.60, LOW < 0.60 */
  confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Puncak akselerasi Z (dalam G) */
  zAccelPeak: number;
  /** Versi model inferensi */
  modelVersion: string;
  /** Payload DTO yang siap dikirim ke backend */
  detectionDto?: CreateDetectionDto;
}
