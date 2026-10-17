import { useState, useCallback, useRef } from 'react';
import { defaultEdgeDetector } from '@/edge-ai/detector';
import { useTfliteModel } from '@/edge-ai/tflite-model';
import { EDGE_AI_CONFIG } from '@/edge-ai/model-config';
import type {
  EdgeDetectionResult,
  SensorFrame,
  RawSensorSample,
  SensorWindow,
} from '@/edge-ai/types';
import { offlineQueue } from '@/services/api/offline-queue';

/**
 * Hook utama Edge AI HyperGrid v2.
 *
 * Cara kerja:
 * 1. Model TFLite (hg_model_v2.tflite) dimuat satu kali saat hook mount.
 * 2. Setiap sampel sensor (acc + gyro + speed) ditambahkan ke buffer window
 *    via `addSample()`. Buffer mempertahankan sampel dalam jendela waktu 1.5 detik.
 * 3. Saat dipanggil, `runInference()` mengevaluasi window sensor:
 *    - Mode A: Full TFLite (47 fitur) jika model native siap
 *    - Mode B: Smart Window Heuristic (3D EMA gravity removal, Crest Factor, ratio vertikal/horizontal)
 *    - Mode C: Fallback frame tunggal terkalibrasi
 * 4. Saat anomali terdeteksi secara valid, hasil dikirim ke backend / offline queue.
 */
export function useEdgeAi() {
  const {
    predict,
    isReady: modelReady,
    isLoading: modelLoading,
    error: modelError,
  } = useTfliteModel();

  const [lastResult, setLastResult] = useState<EdgeDetectionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [detectedCount, setDetectedCount] = useState<number>(0);

  // Rolling window buffer — sampel dibuang jika sudah lewat windowSizeMs
  const windowBufferRef = useRef<RawSensorSample[]>([]);

  /**
   * Tambahkan satu sampel sensor ke rolling window buffer.
   * Dipanggil setiap kali Accelerometer + Gyroscope menghasilkan data baru.
   */
  const addSample = useCallback((sample: RawSensorSample) => {
    const now = sample.timestampMs;
    const cutoff = now - EDGE_AI_CONFIG.windowSizeMs;

    // Tambah sampel baru
    windowBufferRef.current.push(sample);

    // Buang sampel yang sudah lewat batas window
    while (
      windowBufferRef.current.length > 0 &&
      windowBufferRef.current[0].timestampMs < cutoff
    ) {
      windowBufferRef.current.shift();
    }
  }, []);

  /**
   * Jalankan inferensi pada snapshot window buffer saat ini.
   *
   * @param coords        Koordinat GPS saat deteksi
   * @param options       offlineOnly: paksa simpan ke queue tanpa kirim server
   * @param vehicleConfig Ambang batas sensor adaptif sesuai jenis kendaraan
   */
  const runInference = useCallback(
    async (
      coords: { latitude: number; longitude: number },
      options?: { offlineOnly?: boolean },
      vehicleConfig?: {
        zShockThreshold?: number;
        minMovingSpeed?: number;
        severityThresholds?: { severe: number; high: number; medium: number };
      }
    ): Promise<EdgeDetectionResult | null> => {
      setIsProcessing(true);
      try {
        const snapshot = [...windowBufferRef.current];

        const window: SensorWindow = {
          samples: snapshot,
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp: new Date().toISOString(),
        };

        let result: EdgeDetectionResult;

        if (modelReady && snapshot.length >= EDGE_AI_CONFIG.minSamplesForInference) {
          // ── Mode A: Full TFLite (47 fitur matematis dari window) ───────────
          result = await defaultEdgeDetector.inferWindow(window, predict);
        } else if (snapshot.length >= 3) {
          // ── Mode B: Smart Window Heuristic (3D EMA Gravitasi + Crest Factor) ─
          result = defaultEdgeDetector.inferWindowHeuristic(window, vehicleConfig);
        } else {
          // ── Mode C: Fallback frame tunggal terkalibrasi ────────────────────
          const zValues = snapshot.map((s) => Math.abs(s.az));
          const zPeak = zValues.length > 0 ? Math.max(...zValues) : 0;
          const speedAvg =
            snapshot.length > 0
              ? snapshot.reduce((s, c) => s + c.speedKmh, 0) / snapshot.length
              : 0;

          const frame: SensorFrame = {
            zAccel: zPeak,
            latitude: coords.latitude,
            longitude: coords.longitude,
            speedKmh: speedAvg,
            timestamp: new Date().toISOString(),
          };
          result = defaultEdgeDetector.inferLegacy(frame);
        }

        setLastResult(result);

        if (result.isAnomalyDetected) {
          setDetectedCount((prev) => prev + 1);
          await defaultEdgeDetector.processAndIngest(result, options);
        }

        return result;
      } catch (err) {
        console.warn('[useEdgeAi] Inferensi gagal:', err);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [modelReady, predict]
  );

  /**
   * Reset buffer window (gunakan saat ride baru dimulai).
   */
  const resetWindow = useCallback(() => {
    windowBufferRef.current = [];
  }, []);

  /**
   * Trigger simulasi deteksi manual untuk testing.
   * Mengisi buffer dengan sinyal guncangan sintetis dan langsung infer.
   */
  const triggerSimulatedDetection = useCallback(
    async (coords: { latitude: number; longitude: number; speedKmh?: number }) => {
      const now = Date.now();
      const syntheticSamples: RawSensorSample[] = Array.from(
        { length: 20 },
        (_, i) => {
          const t = now - (20 - i) * EDGE_AI_CONFIG.sampleRateMs;
          const isPeak = i >= 8 && i <= 10;
          const az = isPeak
            ? -(3.6 + Math.random() * 0.3)
            : -(1.0 + (Math.random() - 0.5) * 0.1);
          const ax = isPeak ? (Math.random() - 0.5) * 0.4 : (Math.random() - 0.5) * 0.05;
          const ay = isPeak ? (Math.random() - 0.5) * 0.3 : (Math.random() - 0.5) * 0.05;
          const gPeak = isPeak ? Math.random() * 1.5 : Math.random() * 0.05;
          return {
            ax,
            ay,
            az,
            gx: isPeak ? gPeak : Math.random() * 0.05,
            gy: isPeak ? gPeak * 0.6 : Math.random() * 0.05,
            gz: isPeak ? gPeak * 0.4 : Math.random() * 0.03,
            speedKmh: coords.speedKmh ?? 35,
            timestampMs: t,
          };
        }
      );

      windowBufferRef.current = syntheticSamples;

      return runInference(coords, { offlineOnly: false });
    },
    [runInference]
  );

  const processFrame = useCallback(
    async (
      frame: SensorFrame,
      options?: { offlineOnly?: boolean }
    ): Promise<EdgeDetectionResult> => {
      const result = defaultEdgeDetector.inferLegacy(frame);
      setLastResult(result);
      if (result.isAnomalyDetected) {
        setDetectedCount((prev) => prev + 1);
        await defaultEdgeDetector.processAndIngest(result, options);
      }
      return result;
    },
    []
  );

  return {
    lastResult,
    isProcessing,
    detectedCount,
    modelReady,
    modelLoading,
    modelError,
    deviceId: defaultEdgeDetector.getDeviceId(),
    addSample,
    processFrame,
    runInference,
    resetWindow,
    triggerSimulatedDetection,
    queueSize: offlineQueue.size(),
  };
}
