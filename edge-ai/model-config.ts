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
  windowSizeMs: 1500,       // 1.5 detik per window
  sampleRateMs: 50,         // Target 20 Hz (50ms interval)
  minSamplesForInference: 15, // Minimal 15 sampel (~750ms) agar ekstraksi valid

  /** Cooldown antar deteksi untuk menghindari duplicate event */
  detectionCooldownMs: 3000,

  /** Tingkatan keyakinan */
  confidenceTiers: {
    high: 0.80,
    medium: 0.60,
  },

  /** Ambang batas severity berdasarkan probability */
  severityThresholds: {
    severe:  0.92,
    medium:  0.75,
    low:     0.50,
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
 * Severity fallback dari Z-peak (digunakan saat model belum siap / mode legacy).
 */
export function classifySeverityFromZPeak(zPeak: number): PotholeSeverity {
  if (zPeak >= 3.8) return 'severe';
  if (zPeak >= 2.8) return 'high';
  if (zPeak >= 1.8) return 'medium';
  return 'low';
}
