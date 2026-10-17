import type { PotholeSeverity } from './types';

/**
 * Konfigurasi Model HyperGrid v2 (TFLite — 47 fitur, output [1,1] float32)
 * Threshold optimal 0.50 berasal dari proses pelatihan model.
 */
export const EDGE_AI_CONFIG = {
  modelVersion: 'hg_model_v2',
  deviceIdPrefix: 'hypergrid-edge-',

  /** Threshold probabilitas klasifikasi pothole (dari guide) */
  optimalThreshold: 0.50,

  /** Panjang window sampling sensor (jumlah sampel per inferensi) */
  windowSizeMs: 1500, // 1.5 detik per window
  sampleRateMs: 50, // Target 20 Hz (50ms interval)
  minSamplesForInference: 15, // Minimal 15 sampel (~750ms) agar ekstraksi valid

  /** Cooldown antar deteksi untuk menghindari duplicate event */
  detectionCooldownMs: 3000,

  /** Kecepatan minimum kendaraan (km/jam) agar evaluasi lubang jalan aktif */
  minDetectionSpeedKmh: 10.0,

  /** Ambang batas guncangan vertikal dinamis minimum (di atas 1G gravitasi bumi) */
  defaultShockThresholdG: 1.10,

  /** Tingkatan keyakinan */
  confidenceTiers: {
    high: 0.80,
    medium: 0.60,
  },

  /** Ambang batas severity berdasarkan probability */
  severityThresholds: {
    severe: 0.92,
    medium: 0.75,
    low: 0.50,
  },
} as const;

/**
 * Menghitung tier keyakinan model berdasarkan probability output.
 */
export function getConfidenceTier(
  probability: number,
  threshold = EDGE_AI_CONFIG.optimalThreshold
): { confidenceScore: number; confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' } {
  const confidenceScore =
    probability >= threshold ? probability : 1.0 - probability;

  let confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (confidenceScore >= EDGE_AI_CONFIG.confidenceTiers.high) {
    confidenceTier = 'HIGH';
  } else if (confidenceScore >= EDGE_AI_CONFIG.confidenceTiers.medium) {
    confidenceTier = 'MEDIUM';
  }

  return { confidenceScore, confidenceTier };
}

/**
 * Mengklasifikasikan severity berdasarkan probability pothole.
 */
export function classifySeverityFromProbability(prob: number): PotholeSeverity {
  if (prob >= EDGE_AI_CONFIG.severityThresholds.severe) return 'severe';
  if (prob >= EDGE_AI_CONFIG.severityThresholds.medium) return 'high';
  if (prob >= EDGE_AI_CONFIG.severityThresholds.low) return 'medium';
  return 'low';
}

/**
 * Severity fallback dari puncak guncangan vertikal.
 * Mendukung baik dynamic shock (deviasi dari gravitasi 1G) maupun total acceleration.
 */
export function classifySeverityFromZPeak(
  peakG: number,
  thresholds?: { severe: number; high: number; medium: number }
): PotholeSeverity {
  // Jika peakG > 1.8 dan thresholds tidak disediakan, asumsikan totalG dan konversi ke deviasi dinamis
  const dynamicG = peakG >= 1.8 ? peakG - 1.0 : peakG;

  const severe = thresholds?.severe ?? 2.2;
  const high = thresholds?.high ?? 1.6;
  const medium = thresholds?.medium ?? 1.1;

  if (dynamicG >= severe) return 'severe';
  if (dynamicG >= high) return 'high';
  if (dynamicG >= medium) return 'medium';
  return 'low';
}
