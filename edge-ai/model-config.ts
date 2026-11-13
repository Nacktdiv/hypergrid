import type {
  ClusterSeverity,
  DetectionValidationStatus,
  PotholeSeverity,
  RawSensorSample,
} from './types';

/**
 * Konfigurasi Model HyperGrid v2 (TFLite — 47 fitur, output [1,1] float32)
 * Disertai kriteria Strict Dual-Filter (Visual Probability + Mechanical Sensor G-Force).
 */
export const EDGE_AI_CONFIG = {
  modelVersion: 'hg_model_v2',
  deviceIdPrefix: 'hypergrid-edge-',

  /** Threshold probabilitas klasifikasi pothole */
  optimalThreshold: 0.50,
  /** Threshold konfirmasi tinggi (mencegah false positive visual) */
  highConfidenceThreshold: 0.70,

  /** Panjang window sampling sensor (jumlah sampel per inferensi) */
  windowSizeMs: 1500, // 1.5 detik per window
  sampleRateMs: 50, // Target 20 Hz (50ms interval)
  minSamplesForInference: 15, // Minimal 15 sampel (~750ms) agar ekstraksi valid

  /** Cooldown antar deteksi untuk menghindari duplicate event */
  detectionCooldownMs: 3000,

  /** Kecepatan minimum kendaraan (km/jam) agar evaluasi lubang jalan aktif */
  minDetectionSpeedKmh: 2.0,

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

  /** Tingkatan keyakinan visual */
  confidenceTiers: {
    high: 0.70,
    medium: 0.50,
  },

  /**
   * Ambang batas keparahan fisik (Severity) berdasarkan hentakan vertikal zAccelPeak (G-Force).
   * Nilai probabilitas 'confidence' (p) adalah keyakinan visual ("Apakah ini lubang?"),
   * BUKAN ukuran kedalaman / keparahan fisik lubang.
   */
  physicalSeverityThresholds: {
    severe: 2.50,
    high: 1.80,
    medium: 1.20,
    low: 0.00,
  },

  /** Ambang batas legacy (deprecated) */
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
  if (confidenceScore >= EDGE_AI_CONFIG.highConfidenceThreshold) {
    confidenceTier = 'HIGH';
  } else if (confidenceScore >= EDGE_AI_CONFIG.optimalThreshold) {
    confidenceTier = 'MEDIUM';
  }

  return { confidenceScore, confidenceTier };
}

export type VehicleType = 'car' | 'motor' | 'bicycle';

/**
 * Konfigurasi ambang batas hentakan minimum dan severity per jenis kendaraan:
 * - Car (Family MPV / Sedan): Suspensi lembut meredam getaran kabin.
 * - Motor (Sepeda Motor): Stang motor terhubung langsung ke suspensi teleskopik & getaran mesin.
 * - Bicycle (Sepeda): Tanpa mesin, kecepatan rendah, getaran jalan langsung terasa di frame.
 */
export const VEHICLE_SHOCK_PROFILES: Record<
  VehicleType,
  {
    minShockThreshold: number;
    severityThresholds: { severe: number; high: number; medium: number };
  }
> = {
  car: {
    minShockThreshold: 1.05,
    severityThresholds: { severe: 2.20, high: 1.55, medium: 1.05 },
  },
  motor: {
    minShockThreshold: 1.25,
    severityThresholds: { severe: 2.60, high: 1.85, medium: 1.25 },
  },
  bicycle: {
    minShockThreshold: 1.00,
    severityThresholds: { severe: 2.20, high: 1.60, medium: 1.00 },
  },
};

export const DEFAULT_PHYSICAL_SEVERITY_THRESHOLDS = {
  minShockThreshold: 1.20,
  severe: 2.50,
  high: 1.80,
  medium: 1.20,
};

export function getVehicleShockConfig(
  vehicleOrThresholds?:
    | VehicleType
    | { severe: number; high: number; medium: number; minShockThreshold?: number }
    | string
    | null
) {
  if (!vehicleOrThresholds) return DEFAULT_PHYSICAL_SEVERITY_THRESHOLDS;
  if (typeof vehicleOrThresholds === 'object') {
    return {
      minShockThreshold:
        vehicleOrThresholds.minShockThreshold ??
        vehicleOrThresholds.medium ??
        DEFAULT_PHYSICAL_SEVERITY_THRESHOLDS.minShockThreshold,
      severe: vehicleOrThresholds.severe,
      high: vehicleOrThresholds.high,
      medium: vehicleOrThresholds.medium,
    };
  }

  const key = vehicleOrThresholds.toLowerCase().trim();
  if (key === 'car' || key === 'mobil') {
    return {
      minShockThreshold: VEHICLE_SHOCK_PROFILES.car.minShockThreshold,
      ...VEHICLE_SHOCK_PROFILES.car.severityThresholds,
    };
  }
  if (key === 'motor' || key === 'motorcycle' || key === 'motorbike') {
    return {
      minShockThreshold: VEHICLE_SHOCK_PROFILES.motor.minShockThreshold,
      ...VEHICLE_SHOCK_PROFILES.motor.severityThresholds,
    };
  }
  if (key === 'bicycle' || key === 'sepeda' || key === 'bike') {
    return {
      minShockThreshold: VEHICLE_SHOCK_PROFILES.bicycle.minShockThreshold,
      ...VEHICLE_SHOCK_PROFILES.bicycle.severityThresholds,
    };
  }
  return DEFAULT_PHYSICAL_SEVERITY_THRESHOLDS;
}

/** Parameter input evaluasi Strict Dual-Filter */
export interface DetectionFilterCriteria {
  confidence: number;
  zAccelPeak?: number | null;
  speedKmh?: number | null;
  vehicleType?: VehicleType | string | null;
  vehicleThresholds?: {
    severe: number;
    high: number;
    medium: number;
    minShockThreshold?: number;
  } | null;
}

/** Hasil evaluasi Strict Dual-Filter */
export interface DetectionFilterEvaluation {
  status: DetectionValidationStatus;
  isValidPothole: boolean;
  isConfirmed: boolean;
  needsClusterConfirmation: boolean;
  isRejected: boolean;
  severity: ClusterSeverity;
  reason: string;
}

/**
 * 1. Tahap Klasifikasi & Validasi (Mencegah False Positive) — Strict Dual-Filter Adaptif Kendaraan:
 * - CONFIRMED (Lolos Utama): confidence >= 0.70
 * - CONFIRMED VIA SENSOR: 0.50 <= confidence < 0.70 DAN zAccelPeak >= sensorShockThreshold (disesuaikan jenis kendaraan)
 * - UNCERTAIN (Butuh Konfirmasi DBSCAN): 0.50 <= confidence < 0.70 DAN zAccelPeak < sensorShockThreshold
 * - REJECTED (Noise/Bukan Lubang): confidence < 0.50 ATAU (speedKmh > 60 dan zAccelPeak < minShockThreshold)
 */
export function evaluateDetectionStatus(
  input: DetectionFilterCriteria
): DetectionValidationStatus {
  const { confidence, zAccelPeak, speedKmh, vehicleType, vehicleThresholds } = input;
  const peak = zAccelPeak != null && !isNaN(zAccelPeak) ? Math.abs(zAccelPeak) : 0;
  const cfg = getVehicleShockConfig(vehicleThresholds || vehicleType);

  // 1. REJECTED:
  // Jika confidence < 0.50 ATAU (kecepatan > 60 km/h tanpa hentakan nyata di bawah batas getaran kendaraan)
  if (
    confidence < 0.50 ||
    (speedKmh != null && speedKmh > 60.0 && peak < cfg.minShockThreshold)
  ) {
    return 'REJECTED';
  }

  // 2. CONFIRMED (Lolos Utama):
  if (confidence >= 0.70) {
    return 'CONFIRMED';
  }

  // 3. CONFIRMED VIA SENSOR:
  // Lolos bila hentakan menembus sensorShockThreshold (1.6G) ATAU menembus batas getaran kendaraan dengan confidence >= 0.55
  const sensorShockThreshold = Math.min(1.6, cfg.high);
  if (
    confidence >= 0.50 &&
    (peak >= sensorShockThreshold ||
      (confidence >= 0.55 && peak >= cfg.minShockThreshold))
  ) {
    return 'CONFIRMED_VIA_SENSOR';
  }

  // 4. UNCERTAIN (Butuh Konfirmasi DBSCAN):
  if (confidence >= 0.50) {
    return 'UNCERTAIN';
  }

  return 'REJECTED';
}

/**
 * 2. Tahap Penentuan Severity Fleksibel (Berdasarkan Hentakan Fisik zAccelPeak & Jenis Kendaraan):
 * Hitung keparahan HANYA untuk data yang lolos sebagai pothole:
 * - severe: zAccelPeak >= severeThresh
 * - high: highThresh <= zAccelPeak < severeThresh
 * - medium: mediumThresh <= zAccelPeak < highThresh
 * - low: zAccelPeak < mediumThresh
 */
export function calculatePhysicalSeverity(
  zAccelPeak?: number | null,
  vehicleOrThresholds?:
    | VehicleType
    | { severe: number; high: number; medium: number }
    | string
    | null
): ClusterSeverity {
  if (zAccelPeak == null || isNaN(zAccelPeak)) {
    return 'low';
  }

  const peak = Math.abs(zAccelPeak);
  const cfg = getVehicleShockConfig(vehicleOrThresholds);

  if (peak >= cfg.severe) return 'severe';
  if (peak >= cfg.high) return 'high';
  if (peak >= cfg.medium) return 'medium';
  return 'low';
}

/**
 * Evaluasi menyeluruh deteksi menggabungkan validasi ganda dan penentuan keparahan fisik.
 */
export function evaluateDetection(
  input: DetectionFilterCriteria
): DetectionFilterEvaluation {
  const status = evaluateDetectionStatus(input);
  const isValidPothole = status === 'CONFIRMED' || status === 'CONFIRMED_VIA_SENSOR';
  const cfg = getVehicleShockConfig(input.vehicleThresholds || input.vehicleType);
  const severity = calculatePhysicalSeverity(input.zAccelPeak, cfg);

  let reason = 'Deteksi terkonfirmasi lolos kriteria utama (confidence >= 0.70)';
  if (status === 'CONFIRMED_VIA_SENSOR') {
    reason = `Terkonfirmasi via sensor suspensi (0.50 <= conf < 0.70 & zAccelPeak >= ${Math.min(2.0, cfg.high).toFixed(1)}G)`;
  } else if (status === 'UNCERTAIN') {
    reason = 'Data uncertain: perlu konfirmasi akumulasi DBSCAN';
  } else if (status === 'REJECTED') {
    reason =
      input.confidence < 0.50
        ? 'Ditolak: confidence < 0.50'
        : `Ditolak: kecepatan > 60 km/h tanpa hentakan fisik (zAccelPeak < ${cfg.minShockThreshold.toFixed(1)}G)`;
  }

  return {
    status,
    isValidPothole,
    isConfirmed: isValidPothole,
    needsClusterConfirmation: status === 'UNCERTAIN',
    isRejected: status === 'REJECTED',
    severity,
    reason,
  };
}

/**
 * @deprecated Konsep usang: Probabilitas 'confidence' model (p) adalah keyakinan visual,
 * BUKAN tingkat keparahan jalan. Gunakan `calculatePhysicalSeverity(zAccelPeak)`.
 */
export function classifySeverityFromProbability(prob: number): PotholeSeverity {
  if (prob >= EDGE_AI_CONFIG.severityThresholds.severe) return 'severe';
  if (prob >= EDGE_AI_CONFIG.severityThresholds.medium) return 'high';
  if (prob >= EDGE_AI_CONFIG.severityThresholds.low) return 'medium';
  return 'low';
}

/**
 * Menghitung akselerasi vertikal dinamis terkalibrasi kecepatan (Speed-Normalized Shock Index).
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
 * Menentukan severity dari puncak guncangan vertikal zAccelPeak.
 * Mengikuti threshold baru: severe >= 2.5, high >= 1.8, medium >= 1.2, low < 1.2.
 */
export function classifySeverityFromZPeak(
  peakG: number,
  thresholds?: { severe: number; high: number; medium: number },
  speedKmh?: number
): PotholeSeverity {
  const dynamicG = peakG >= 1.8 ? peakG - 1.0 : peakG;
  const calibratedG =
    speedKmh != null && speedKmh > 0
      ? calculateSpeedNormalizedG(dynamicG, speedKmh)
      : dynamicG;

  const severe = thresholds?.severe ?? 2.50;
  const high = thresholds?.high ?? 1.80;
  const medium = thresholds?.medium ?? 1.20;

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
