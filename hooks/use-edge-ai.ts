import { useState, useCallback } from 'react';
import { defaultEdgeDetector } from '@/edge-ai/detector';
import type { EdgeDetectionResult, SensorFrame } from '@/edge-ai/types';
import { offlineQueue } from '@/services/api/offline-queue';

/**
 * Hook untuk mengontrol inferensi Edge AI di perangkat mobile.
 * Mendukung pemrosesan real-time data sensor serta trigger deteksi simulasi untuk testing.
 */
export function useEdgeAi() {
  const [lastResult, setLastResult] = useState<EdgeDetectionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [detectedCount, setDetectedCount] = useState<number>(0);

  /**
   * Memproses satu frame data sensor melalui Edge AI
   */
  const processFrame = useCallback(
    async (frame: SensorFrame, options?: { offlineOnly?: boolean }) => {
      setIsProcessing(true);
      try {
        const result = await defaultEdgeDetector.processAndIngest(frame, options);
        setLastResult(result);
        if (result.isAnomalyDetected) {
          setDetectedCount((prev) => prev + 1);
        }
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  /**
   * Memicu deteksi guncangan simulasi untuk testing (dummy confidence)
   */
  const triggerSimulatedDetection = useCallback(
    async (coords: { latitude: number; longitude: number; speedKmh?: number }) => {
      // Simulasikan puncak guncangan akselerometer Z yang signifikan (misal 3.6G)
      const simulatedZPeak = 3.6;
      return processFrame({
        zAccel: simulatedZPeak,
        latitude: coords.latitude,
        longitude: coords.longitude,
        speedKmh: coords.speedKmh ?? 40.0,
        timestamp: new Date().toISOString(),
      });
    },
    [processFrame]
  );

  return {
    lastResult,
    isProcessing,
    detectedCount,
    deviceId: defaultEdgeDetector.getDeviceId(),
    processFrame,
    triggerSimulatedDetection,
    queueSize: offlineQueue.size(),
  };
}
