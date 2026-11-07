import type { PotholeSeverity, RawSensorSample } from './types';

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

  /** Ambang batas penolakan lonjakan ekstrem non-jalan (HP jatuh, diutak-atik, ketukan keras) */
  maxExtremeSpikeG: 4.20,

  /** Ambang batas kecepatan sudut giroskop untuk penolakan perputaran liar (HP terlepas/diambil) */
  maxGyroTumbleRadPerSec: 5.50,

  /** Minimal durasi sampel impuls berturut-turut untuk validasi respons suspensi mekanis */
  minImpulseDurationSamples: 2,

  /** Parameter kalibrasi kecepatan fisis (Speed-Normalized Shock Index) */
  referenceSpeedKmh: 40.0,
  speedNormalizationBeta: 0.5,
  minSpeedNormalizationFactor: 0.65,
  maxSpeedNormalizationFactor: 1.50,

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
 * Menghitung akselerasi vertikal dinamis terkalibrasi kecepatan (Speed-Normalized Shock Index).
 *
 * Fisis: Pada kecepatan rendah (misal 15 km/h), benturan lubang dalam menghasilkan G-force teredam (~1.2G)
 * karena roda masuk perlahan, padahal lubang tersebut sangat berbahaya.
 * Sebaliknya pada kecepatan tinggi (misal 80 km/h), sambungan jalan kecil menghasilkan G-force tajam.
 * Rumus normalisasi: G_norm = G_dyn / (v / v_ref)^beta
 */
export function calculateSpeedNormalizedG(
  dynamicG: number,
  speedKmh: number,
  refSpeed = EDGE_AI_CONFIG.referenceSpeedKmh,
  beta = EDGE_AI_CONFIG.speedNormalizationBeta
): number {
  if (dynamicG <= 0) return 0;
  const effectiveSpeed = Math.max(5.0, speedKmh);
  const rawFactor = Math.pow(effectiveSpeed / refSpeed, beta);
  const clampedFactor = Math.max(
    EDGE_AI_CONFIG.minSpeedNormalizationFactor,
    Math.min(EDGE_AI_CONFIG.maxSpeedNormalizationFactor, rawFactor)
  );
  return dynamicG / clampedFactor;
}

/**
 * Severity fallback dari puncak guncangan vertikal dengan kalibrasi kecepatan fisis.
 * Mendukung baik dynamic shock (deviasi dari gravitasi 1G) maupun total acceleration.
 */
export function classifySeverityFromZPeak(
  peakG: number,
  thresholds?: { severe: number; high: number; medium: number },
  speedKmh?: number
): PotholeSeverity {
  // Jika peakG > 1.8 dan thresholds tidak disediakan, asumsikan totalG dan konversi ke deviasi dinamis
  const dynamicG = peakG >= 1.8 ? peakG - 1.0 : peakG;
  const calibratedG =
    speedKmh != null && speedKmh > 0
      ? calculateSpeedNormalizedG(dynamicG, speedKmh)
      : dynamicG;

  const severe = thresholds?.severe ?? 2.2;
  const high = thresholds?.high ?? 1.6;
  const medium = thresholds?.medium ?? 1.1;

  if (calibratedG >= severe) return 'severe';
  if (calibratedG >= high) return 'high';
  if (calibratedG >= medium) return 'medium';
  return 'low';
}

export interface AnomalyValidationResult {
  isValid: boolean;
  reason:
    | 'valid'
    | 'speed_too_low'
    | 'extreme_g_spike'
    | 'gyro_tumbling'
    | 'single_sample_glitch';
  maxVertDyn: number;
  maxGyroMag: number;
  impulseDuration: number;
}

/**
 * Validasi anomali jalan: Menolak artefak non-jalan (HP jatuh, diutak-atik, ketukan keras)
 * dan memvalidasi durasi impuls fisik suspensi kendaraan.
 */
export function validateRoadAnomaly(
  samples: RawSensorSample[],
  vertDynSignals: number[],
  options?: {
    minMovingSpeed?: number;
    maxExtremeSpikeG?: number;
    maxGyroTumble?: number;
    zShockThreshold?: number;
  }
): AnomalyValidationResult {
  const n = samples.length;
  if (n === 0) {
    return {
      isValid: false,
      reason: 'speed_too_low',
      maxVertDyn: 0,
      maxGyroMag: 0,
      impulseDuration: 0,
    };
  }

  const speedAvg = samples.reduce((s, c) => s + c.speedKmh, 0) / n;
  const minSpeed =
    options?.minMovingSpeed ?? EDGE_AI_CONFIG.minDetectionSpeedKmh;
  if (speedAvg < minSpeed) {
    return {
      isValid: false,
      reason: 'speed_too_low',
      maxVertDyn: 0,
      maxGyroMag: 0,
      impulseDuration: 0,
    };
  }

  const maxVert =
    vertDynSignals.length > 0 ? Math.max(...vertDynSignals) : 0;
  const maxExtreme =
    options?.maxExtremeSpikeG ?? EDGE_AI_CONFIG.maxExtremeSpikeG;

  // 1. Extreme Spike Rejection (HP jatuh / terbanting / ketuk keras)
  if (maxVert > maxExtreme) {
    return {
      isValid: false,
      reason: 'extreme_g_spike',
      maxVertDyn: maxVert,
      maxGyroMag: 0,
      impulseDuration: 1,
    };
  }

  // 2. Gyroscope Tumbling Rejection (HP diambil / terlepas dari mount)
  let maxGyro = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const gm = Math.sqrt(s.gx * s.gx + s.gy * s.gy + s.gz * s.gz);
    if (gm > maxGyro) maxGyro = gm;
  }
  const maxGyroLimit =
    options?.maxGyroTumble ?? EDGE_AI_CONFIG.maxGyroTumbleRadPerSec;
  if (maxGyro > maxGyroLimit) {
    return {
      isValid: false,
      reason: 'gyro_tumbling',
      maxVertDyn: maxVert,
      maxGyroMag: maxGyro,
      impulseDuration: 0,
    };
  }

  // 3. Single-Sample Glitch Gate (impuls fisik suspensi harus bertahan >= 2 sampel di atas 50% threshold)
  const threshold =
    options?.zShockThreshold ?? EDGE_AI_CONFIG.defaultShockThresholdG;
  const halfThreshold = threshold * 0.5;
  let consecutiveCount = 0;
  let maxConsecutive = 0;
  for (let i = 0; i < vertDynSignals.length; i++) {
    if (vertDynSignals[i] >= halfThreshold) {
      consecutiveCount++;
      if (consecutiveCount > maxConsecutive) {
        maxConsecutive = consecutiveCount;
      }
    } else {
      consecutiveCount = 0;
    }
  }

  if (
    maxVert >= threshold &&
    maxConsecutive < EDGE_AI_CONFIG.minImpulseDurationSamples &&
    maxVert > 1.8
  ) {
    return {
      isValid: false,
      reason: 'single_sample_glitch',
      maxVertDyn: maxVert,
      maxGyroMag: maxGyro,
      impulseDuration: maxConsecutive,
    };
  }

  return {
    isValid: true,
    reason: 'valid',
    maxVertDyn: maxVert,
    maxGyroMag: maxGyro,
    impulseDuration: maxConsecutive,
  };
}
