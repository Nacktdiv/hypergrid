import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RawDetection } from '@/types/api';

const HISTORY_STORAGE_KEY = 'HYPERGRID_LOCAL_HISTORY_DETECTIONS_V1';
const MAX_LOCAL_DETECTIONS = 500;

/**
 * Service Penyimpanan Riwayat Deteksi Lokal (Offline Persistence).
 * Menjamin riwayat telemetri tetap tersimpan di HP dan dapat langsung
 * diakses (0 ms) tanpa harus menunggu roundtrip cloud server.
 */
export const historyStorage = {
  /**
   * Mengambil seluruh data riwayat deteksi yang tersimpan secara lokal di HP.
   */
  async getLocalDetections(): Promise<RawDetection[]> {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[HistoryStorage] Gagal membaca riwayat lokal:', err);
      return [];
    }
  },

  /**
   * Menyimpan kumpulan data deteksi ke storage lokal dengan deduplikasi ID.
   * Menggabungkan data baru dari server dengan data lokal yang sudah ada.
   */
  async saveDetections(incoming: RawDetection[]): Promise<RawDetection[]> {
    try {
      if (!incoming || incoming.length === 0) {
        return this.getLocalDetections();
      }

      const existing = await this.getLocalDetections();
      const map = new Map<string, RawDetection>();

      // Masukkan data lama
      for (const item of existing) {
        if (item.id) map.set(item.id, item);
      }

      // Timpa atau tambahkan dengan data terbaru
      for (const item of incoming) {
        if (item.id) map.set(item.id, item);
      }

      // Urutkan dari yang paling baru
      const merged = Array.from(map.values()).sort((a, b) => {
        const timeA = new Date(a.detectedAt || 0).getTime();
        const timeB = new Date(b.detectedAt || 0).getTime();
        return timeB - timeA;
      });

      const capped = merged.slice(0, MAX_LOCAL_DETECTIONS);
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(capped));
      return capped;
    } catch (err) {
      console.warn('[HistoryStorage] Gagal menyimpan riwayat lokal:', err);
      return incoming;
    }
  },

  /**
   * Menyimpan satu deteksi baru (misal saat terdeteksi saat ride).
   */
  async addSingleDetection(detection: RawDetection): Promise<void> {
    try {
      const existing = await this.getLocalDetections();
      const filtered = existing.filter((d) => d.id !== detection.id);
      const updated = [detection, ...filtered].slice(0, MAX_LOCAL_DETECTIONS);
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[HistoryStorage] Gagal menambahkan deteksi lokal:', err);
    }
  },

  /**
   * Menghapus cache riwayat lokal (misal saat user logout total).
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (err) {
      console.warn('[HistoryStorage] Gagal menghapus storage riwayat lokal:', err);
    }
  },
};
