/**
 * Digital High-Pass Filter (HPF) untuk Sinyal Akselerasi Vertikal.
 *
 * Mengeliminasi komponen frekuensi rendah (< 1.8 Hz):
 * - Perubahan kemiringan jalan (tanjakan / turunan / tikungan miring)
 * - Ayunan suspensi lambat (body roll & chassis sway)
 * - Gelombang aspal panjang yang halus
 *
 * Karakteristik:
 * - Sampling rate: 20 Hz (dt = 50ms)
 * - Frekuensi cutoff default (fc): 1.8 Hz
 * - Algoritma: 1st-order discrete IIR High-Pass Filter:
 *     y[n] = alpha * (y[n-1] + x[n] - x[n-1])
 *     alpha = RC / (RC + dt), dengan RC = 1 / (2 * pi * fc)
 */

export class HighPassFilter {
  private alpha: number;
  private prevInput: number = 0;
  private prevOutput: number = 0;
  private initialized: boolean = false;
  private readonly cutoffHz: number;
  private readonly sampleRateHz: number;

  constructor(cutoffHz = 1.2, sampleRateHz = 20) {
    this.cutoffHz = cutoffHz;
    this.sampleRateHz = sampleRateHz;
    const dt = 1 / sampleRateHz;
    const rc = 1 / (2 * Math.PI * cutoffHz);
    this.alpha = rc / (rc + dt);
  }

  /**
   * Filter satu sampel data secara streaming real-time (stateful).
   */
  public filter(input: number): number {
    if (!this.initialized) {
      this.prevInput = input;
      this.prevOutput = 0;
      this.initialized = true;
      return 0;
    }

    const output = this.alpha * (this.prevOutput + input - this.prevInput);
    this.prevInput = input;
    this.prevOutput = output;
    return output;
  }

  /**
   * Reset state filter (misalnya saat perjalanan baru dimulai atau dijeda).
   */
  public reset(): void {
    this.prevInput = 0;
    this.prevOutput = 0;
    this.initialized = false;
  }

  /**
   * Filter seluruh array sinyal secara batch (stateless/pure).
   * Berguna untuk window ekstraksi fitur.
   */
  public static filterArray(
    signal: number[],
    cutoffHz = 1.8,
    sampleRateHz = 20
  ): number[] {
    const n = signal.length;
    if (n === 0) return [];
    if (n === 1) return [0];

    const dt = 1 / sampleRateHz;
    const rc = 1 / (2 * Math.PI * cutoffHz);
    const alpha = rc / (rc + dt);

    const filtered = new Array<number>(n);
    filtered[0] = 0;

    for (let i = 1; i < n; i++) {
      filtered[i] = alpha * (filtered[i - 1] + signal[i] - signal[i - 1]);
    }

    return filtered;
  }
}
