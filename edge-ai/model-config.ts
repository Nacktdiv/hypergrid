import type { PotholeSeverity, RoadAnomalyType } from './types';

export const EDGE_AI_CONFIG = {
  modelVersion: 'v1.0-edge-mobile',
  deviceIdPrefix: 'hypergrid-edge-',
  
  // Ambang batas puncak akselerasi vertikal Z (satuan G)
  thresholds: {
    low: 1.8,
    medium: 2.8,
    severe: 3.8,
  },

  // Pengaturan dummy confidence AI untuk tahap pengujian awal
  dummyConfidence: {
    min: 0.85,
    max: 0.98,
  },
};

/**
 * Generator nilai confidence AI dummy untuk fase testing.
 * Menghasilkan angka float 2 desimal di rentang [min, max] (misal: 0.91).
 */
export function generateDummyConfidence(
  min = EDGE_AI_CONFIG.dummyConfidence.min,
  max = EDGE_AI_CONFIG.dummyConfidence.max
): number {
  const raw = Math.random() * (max - min) + min;
  return Math.round(raw * 100) / 100;
}

/**
 * Mengklasifikasikan tingkat keparahan berdasarkan zAccelPeak
 */
export function classifySeverityFromZPeak(zPeak: number): PotholeSeverity {
  if (zPeak >= EDGE_AI_CONFIG.thresholds.severe) return 'severe';
  if (zPeak >= EDGE_AI_CONFIG.thresholds.medium) return 'medium';
  if (zPeak >= EDGE_AI_CONFIG.thresholds.low) return 'low';
  return 'low';
}
