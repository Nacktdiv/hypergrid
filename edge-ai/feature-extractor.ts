import type { RawSensorSample } from './types';

// ─── Statistik dasar ────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[], m?: number): number {
  if (arr.length < 2) return 0;
  const mu = m ?? mean(arr);
  const variance = arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function rms(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.sqrt(arr.reduce((s, v) => s + v * v, 0) / arr.length);
}

function minVal(arr: number[]): number {
  return arr.reduce((a, b) => Math.min(a, b), arr[0] ?? 0);
}

function maxVal(arr: number[]): number {
  return arr.reduce((a, b) => Math.max(a, b), arr[0] ?? 0);
}

/** Statistik set: [mean, std, min, max, range, rms] */
function stats6(arr: number[]): [number, number, number, number, number, number] {
  const mu = mean(arr);
  const mn = minVal(arr);
  const mx = maxVal(arr);
  return [mu, std(arr, mu), mn, mx, mx - mn, rms(arr)];
}

/** Zero-crossing rate (berapa kali tanda berubah dari positif ke negatif atau sebaliknya) */
function zeroCrossingRate(arr: number[]): number {
  if (arr.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i - 1] * arr[i] < 0) crossings++;
  }
  return crossings / (arr.length - 1);
}

/** Crest factor = max / rms  (rasio puncak-ke-RMS) */
function crestFactor(arr: number[]): number {
  const r = rms(arr);
  return r === 0 ? 0 : maxVal(arr.map(Math.abs)) / r;
}

/** Hitung jerk (diferensial/dt) dari sinyal dengan dt = timestampMs diff */
function computeJerk(values: number[], timesMs: number[]): number[] {
  const jerk: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const dt = (timesMs[i] - timesMs[i - 1]) / 1000; // detik
    jerk.push(dt > 0 ? (values[i] - values[i - 1]) / dt : 0);
  }
  return jerk;
}

// ─── Ekstraksi 47 fitur ──────────────────────────────────────────────────────

/**
 * Mengekstraksi tepat 47 fitur dari window N sampel sensor.
 *
 * Urutan persis sesuai TFLITE_INTEGRATION_GUIDE.md:
 *  [0..5]   vert_dyn (az sinyal dinamis): mean, std, min, max, range, rms
 *  [6..11]  horiz_dyn (magnitude XY): mean, std, min, max, range, rms
 *  [12..17] acc_mag (|a| total): mean, std, min, max, range, rms
 *  [18..23] gyro_mag (|g| total): mean, std, min, max, range, rms
 *  [24..29] jerk_vert: mean, std, min, max, range, rms
 *  [30..35] gyro_jerk_mag: mean, std, min, max, range, rms
 *  [36..41] speed_clean: mean, std, min, max, range, rms
 *  [42]     crest_factor_vert
 *  [43]     vert_to_horiz_ratio
 *  [44]     speed_norm_vert_shock
 *  [45]     vert_zcr
 *  [46]     is_moving (0 atau 1)
 *
 * @returns Float32Array panjang 47 siap diumpan ke model TFLite.
 */
export function extractFeatures(samples: RawSensorSample[]): Float32Array {
  const n = samples.length;

  // --- Pisahkan sinyal mentah ---
  const azRaw    = samples.map(s => s.az);
  const axRaw    = samples.map(s => s.ax);
  const ayRaw    = samples.map(s => s.ay);
  const gxRaw    = samples.map(s => s.gx);
  const gyRaw    = samples.map(s => s.gy);
  const gzRaw    = samples.map(s => s.gz);
  const speedArr = samples.map(s => s.speedKmh);
  const timesMs  = samples.map(s => s.timestampMs);

  // --- Sinyal dinamis: hilangkan komponen gravitasi dari az ---
  // Estimasi gravitasi dengan rata-rata (baseline DC) lalu substraksi
  const azMeanDc = mean(azRaw);
  const vertDyn  = azRaw.map(v => v - azMeanDc);   // komponen guncangan saja

  // --- Magnitudo horizontal (akar XY tanpa komponen gravitasi) ---
  const horizDyn = samples.map((s) => {
    const xd = s.ax - mean(axRaw);  // remove DC
    const yd = s.ay - mean(ayRaw);
    return Math.sqrt(xd * xd + yd * yd);
  });

  // --- Magnitudo akselerometer total ---
  const accMag = samples.map(s =>
    Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az)
  );

  // --- Magnitudo gyroscope total ---
  const gyroMag = samples.map(s =>
    Math.sqrt(s.gx * s.gx + s.gy * s.gy + s.gz * s.gz)
  );

  // --- Jerk vertikal (turunan vertDyn terhadap waktu) ---
  const jerkVert = computeJerk(vertDyn, timesMs);
  if (jerkVert.length === 0) jerkVert.push(0);

  // --- Jerk magnitudo gyroscope ---
  const gyroJerk = computeJerk(gyroMag, timesMs);
  if (gyroJerk.length === 0) gyroJerk.push(0);

  // --- Kecepatan bersih (clamp negatif ke 0) ---
  const speedClean = speedArr.map(v => Math.max(0, v));

  // --- Statistik 6 dimensi per sinyal ---
  const [vd_mean, vd_std, vd_min, vd_max, vd_rng, vd_rms]   = stats6(vertDyn);
  const [hd_mean, hd_std, hd_min, hd_max, hd_rng, hd_rms]   = stats6(horizDyn);
  const [am_mean, am_std, am_min, am_max, am_rng, am_rms]    = stats6(accMag);
  const [gm_mean, gm_std, gm_min, gm_max, gm_rng, gm_rms]   = stats6(gyroMag);
  const [jv_mean, jv_std, jv_min, jv_max, jv_rng, jv_rms]   = stats6(jerkVert);
  const [gj_mean, gj_std, gj_min, gj_max, gj_rng, gj_rms]   = stats6(gyroJerk);
  const [sp_mean, sp_std, sp_min, sp_max, sp_rng, sp_rms]    = stats6(speedClean);

  // --- 5 fitur kustom ---
  const crestFactorVert    = crestFactor(vertDyn);
  const vertToHorizRatio   = hd_rms > 0 ? vd_rms / hd_rms : 0;
  const speedNormVertShock = sp_mean > 0 ? vd_rms / sp_mean : vd_rms;
  const vertZcr            = zeroCrossingRate(vertDyn);
  const isMoving           = sp_mean > 2.0 ? 1.0 : 0.0;  // bergerak jika rata-rata kecepatan > 2 km/h

  // --- Susun 47 fitur dalam urutan yang sesuai guide ---
  const features = new Float32Array(47);
  let i = 0;

  // [0..5] vert_dyn
  features[i++] = vd_mean; features[i++] = vd_std; features[i++] = vd_min;
  features[i++] = vd_max;  features[i++] = vd_rng; features[i++] = vd_rms;

  // [6..11] horiz_dyn
  features[i++] = hd_mean; features[i++] = hd_std; features[i++] = hd_min;
  features[i++] = hd_max;  features[i++] = hd_rng; features[i++] = hd_rms;

  // [12..17] acc_mag
  features[i++] = am_mean; features[i++] = am_std; features[i++] = am_min;
  features[i++] = am_max;  features[i++] = am_rng; features[i++] = am_rms;

  // [18..23] gyro_mag
  features[i++] = gm_mean; features[i++] = gm_std; features[i++] = gm_min;
  features[i++] = gm_max;  features[i++] = gm_rng; features[i++] = gm_rms;

  // [24..29] jerk_vert
  features[i++] = jv_mean; features[i++] = jv_std; features[i++] = jv_min;
  features[i++] = jv_max;  features[i++] = jv_rng; features[i++] = jv_rms;

  // [30..35] gyro_jerk
  features[i++] = gj_mean; features[i++] = gj_std; features[i++] = gj_min;
  features[i++] = gj_max;  features[i++] = gj_rng; features[i++] = gj_rms;

  // [36..41] speed_clean
  features[i++] = sp_mean; features[i++] = sp_std; features[i++] = sp_min;
  features[i++] = sp_max;  features[i++] = sp_rng; features[i++] = sp_rms;

  // [42..46] fitur kustom
  features[i++] = crestFactorVert;
  features[i++] = vertToHorizRatio;
  features[i++] = speedNormVertShock;
  features[i++] = vertZcr;
  features[i++] = isMoving;

  return features;  // length = 47
}
