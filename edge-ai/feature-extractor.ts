import type { RawSensorSample } from './types';

// ──── Statistik dasar ────────────────────────────────────────────────────────

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
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => Math.min(a, b), arr[0]);
}

function maxVal(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => Math.max(a, b), arr[0]);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Statistik set: [mean, std, min, max, range (ptp), rms] */
function stats6(arr: number[]): [number, number, number, number, number, number] {
  const mu = mean(arr);
  const mn = minVal(arr);
  const mx = maxVal(arr);
  return [mu, std(arr, mu), mn, mx, mx - mn, rms(arr)];
}

export interface DecomposedSignals {
  vertDyn: number[];
  horizDyn: number[];
  accMag: number[];
  gyroMag: number[];
  speedClean: number[];
  gNormAvg: number;
}

/**
 * Dekomposisi sinyal 3D sensor menggunakan Causal EMA Gravity Tracking.
 *
 * 100% konsisten dengan implementasi Python: `RoadFeatureExtractorV2._decompose_signals_causal`.
 * Memproyeksikan vektor akselerasi ke arah gravitasi bumi sesungguhnya,
 * sehingga orientasi HP (miring, tidur, tegak di holder) tidak merusak sinyal vertikal.
 */
export function decomposeSensorSignals(
  samples: RawSensorSample[],
  emaAlpha = 0.1
): DecomposedSignals {
  const n = samples.length;
  if (n === 0) {
    return {
      vertDyn: [],
      horizDyn: [],
      accMag: [],
      gyroMag: [],
      speedClean: [],
      gNormAvg: 1.0,
    };
  }

  const vertDyn: number[] = [];
  const horizDyn: number[] = [];
  const accMag: number[] = [];
  const gyroMag: number[] = [];
  const speedClean: number[] = [];

  let gxCurr = samples[0].ax;
  let gyCurr = samples[0].ay;
  let gzCurr = samples[0].az;
  let totalGNorm = 0;

  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const ax = s.ax;
    const ay = s.ay;
    const az = s.az;

    // 1. Causal Gravity Estimation via Exponential Moving Average (EMA)
    gxCurr = (1.0 - emaAlpha) * gxCurr + emaAlpha * ax;
    gyCurr = (1.0 - emaAlpha) * gyCurr + emaAlpha * ay;
    gzCurr = (1.0 - emaAlpha) * gzCurr + emaAlpha * az;

    const gNorm =
      Math.sqrt(gxCurr * gxCurr + gyCurr * gyCurr + gzCurr * gzCurr) + 1e-6;
    totalGNorm += gNorm;
    const gUnitX = gxCurr / gNorm;
    const gUnitY = gyCurr / gNorm;
    const gUnitZ = gzCurr / gNorm;

    // 2. Dynamic Vertical Shock (Sejajar arah gravitasi bumi, baseline gravitasi dihilangkan)
    const aVert = ax * gUnitX + ay * gUnitY + az * gUnitZ;
    const aVertDyn = Math.abs(aVert - gNorm);

    // 3. Dynamic Horizontal Forces (Tegak lurus gravitasi: belok, rem, akselerasi)
    const diffX = ax - aVert * gUnitX;
    const diffY = ay - aVert * gUnitY;
    const diffZ = az - aVert * gUnitZ;
    const aHorizDyn = Math.sqrt(
      diffX * diffX + diffY * diffY + diffZ * diffZ
    );

    // 4. Magnitudo total
    const am = Math.sqrt(ax * ax + ay * ay + az * az);
    const gm = Math.sqrt(s.gx * s.gx + s.gy * s.gy + s.gz * s.gz);

    vertDyn.push(aVertDyn);
    horizDyn.push(aHorizDyn);
    accMag.push(am);
    gyroMag.push(gm);
    speedClean.push(Math.max(0, s.speedKmh));
  }

  return {
    vertDyn,
    horizDyn,
    accMag,
    gyroMag,
    speedClean,
    gNormAvg: totalGNorm / n,
  };
}

// ─── Ekstraksi 47 fitur ──────────────────────────────────────────────────────

/**
 * Mengekstraksi tepat 47 fitur dari window N sampel sensor.
 *
 * 100% konsisten secara matematis dengan `RoadFeatureExtractorV2` di Python:
 *  [0..5]   vert_dyn: mean, std, min, max, range, rms
 *  [6..11]  horiz_dyn: mean, std, min, max, range, rms
 *  [12..17] acc_mag: mean, std, min, max, range, rms
 *  [18..23] gyro_mag: mean, std, min, max, range, rms
 *  [24..29] jerk_vert: mean, std, min, max, range, rms (np.diff tanpa bagi dt)
 *  [30..35] gyro_jerk_mag: mean, std, min, max, range, rms
 *  [36..41] speed_clean: mean, std, min, max, range, rms
 *  [42]     crest_factor_vert = max_v / (rms_v + 1e-6)
 *  [43]     vert_to_horiz_ratio = (max_v + 1e-6) / (max_h + 1e-6)
 *  [44]     speed_norm_vert_shock = max_v / (mean_spd + 1.5)
 *  [45]     vert_zcr = median-centered zero-crossing rate
 *  [46]     is_moving (1 jika sp_mean >= 1.5 km/h, 0 sebaliknya)
 *
 * @returns Float32Array panjang 47 siap diumpan ke model TFLite.
 */
export function extractFeatures(samples: RawSensorSample[]): Float32Array {
  const { vertDyn, horizDyn, accMag, gyroMag, speedClean } =
    decomposeSensorSignals(samples, 0.1);

  // Jerk Vertikal & Gyroscope (Selisih sampel ke sampel, sesuai pipeline training Python np.diff)
  const jerkVert = [0];
  for (let j = 1; j < vertDyn.length; j++) {
    jerkVert.push(Math.abs(vertDyn[j] - vertDyn[j - 1]));
  }

  const gyroJerk = [0];
  for (let j = 1; j < gyroMag.length; j++) {
    gyroJerk.push(Math.abs(gyroMag[j] - gyroMag[j - 1]));
  }

  // 6 statistik per sinyal
  const [vd_mean, vd_std, vd_min, vd_max, vd_rng, vd_rms] = stats6(vertDyn);
  const [hd_mean, hd_std, hd_min, hd_max, hd_rng, hd_rms] = stats6(horizDyn);
  const [am_mean, am_std, am_min, am_max, am_rng, am_rms] = stats6(accMag);
  const [gm_mean, gm_std, gm_min, gm_max, gm_rng, gm_rms] = stats6(gyroMag);
  const [jv_mean, jv_std, jv_min, jv_max, jv_rng, jv_rms] = stats6(jerkVert);
  const [gj_mean, gj_std, gj_min, gj_max, gj_rng, gj_rms] = stats6(gyroJerk);
  const [sp_mean, sp_std, sp_min, sp_max, sp_rng, sp_rms] = stats6(speedClean);

  // 5 fitur domain kustom
  const crestFactorVert = vd_max / (vd_rms + 1e-6);
  const vertToHorizRatio = (vd_max + 1e-6) / (hd_max + 1e-6);
  const speedNormVertShock = vd_max / (sp_mean + 1.5);

  const medV = median(vertDyn);
  let zcrCrossings = 0;
  for (let j = 1; j < vertDyn.length; j++) {
    const cPrev = vertDyn[j - 1] - medV;
    const cCurr = vertDyn[j] - medV;
    if (cPrev * cCurr < 0) zcrCrossings++;
  }
  const vertZcr =
    vertDyn.length > 1 ? zcrCrossings / (vertDyn.length - 1 + 1e-6) : 0;
  const isMoving = sp_mean >= 1.5 ? 1.0 : 0.0;

  // Susun 47 fitur float32
  const features = new Float32Array(47);
  let idx = 0;

  // [0..5] vert_dyn
  features[idx++] = vd_mean;
  features[idx++] = vd_std;
  features[idx++] = vd_min;
  features[idx++] = vd_max;
  features[idx++] = vd_rng;
  features[idx++] = vd_rms;

  // [6..11] horiz_dyn
  features[idx++] = hd_mean;
  features[idx++] = hd_std;
  features[idx++] = hd_min;
  features[idx++] = hd_max;
  features[idx++] = hd_rng;
  features[idx++] = hd_rms;

  // [12..17] acc_mag
  features[idx++] = am_mean;
  features[idx++] = am_std;
  features[idx++] = am_min;
  features[idx++] = am_max;
  features[idx++] = am_rng;
  features[idx++] = am_rms;

  // [18..23] gyro_mag
  features[idx++] = gm_mean;
  features[idx++] = gm_std;
  features[idx++] = gm_min;
  features[idx++] = gm_max;
  features[idx++] = gm_rng;
  features[idx++] = gm_rms;

  // [24..29] jerk_vert
  features[idx++] = jv_mean;
  features[idx++] = jv_std;
  features[idx++] = jv_min;
  features[idx++] = jv_max;
  features[idx++] = jv_rng;
  features[idx++] = jv_rms;

  // [30..35] gyro_jerk
  features[idx++] = gj_mean;
  features[idx++] = gj_std;
  features[idx++] = gj_min;
  features[idx++] = gj_max;
  features[idx++] = gj_rng;
  features[idx++] = gj_rms;

  // [36..41] speed_clean
  features[idx++] = sp_mean;
  features[idx++] = sp_std;
  features[idx++] = sp_min;
  features[idx++] = sp_max;
  features[idx++] = sp_rng;
  features[idx++] = sp_rms;

  // [42..46] fitur kustom
  features[idx++] = crestFactorVert;
  features[idx++] = vertToHorizRatio;
  features[idx++] = speedNormVertShock;
  features[idx++] = vertZcr;
  features[idx++] = isMoving;

  return features;
}
