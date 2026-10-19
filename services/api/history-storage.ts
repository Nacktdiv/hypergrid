import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RawDetection } from '@/types/api';

const HISTORY_STORAGE_KEY = 'HYPERGRID_LOCAL_HISTORY_DETECTIONS_V1';
const MAX_LOCAL_DETECTIONS = 500;

type HistoryCacheListener = (detections: RawDetection[]) => void;

let memoryCache: RawDetection[] | null = null;
let lastSyncedAtMs = 0;
const listeners = new Set<HistoryCacheListener>();

function isValidAnomalyDetection(item: RawDetection | null | undefined): item is RawDetection {
  if (!item || !item.id) return false;
  // Tolak entri sintetis non-anomali
  if (String(item.id).startsWith('ride_')) return false;
  // Tolak jika confidence <= 0
  if (typeof item.confidence === 'number' && item.confidence <= 0) return false;
  // Tolak jika kendaraan diam / tidak bergerak (< 3.5 km/h)
  if (typeof item.speedKmh === 'number' && item.speedKmh < 3.5) return false;
  // Tolak jika tidak ada lonjakan guncangan nyata (< 0.6G)
  if (typeof item.zAccelPeak === 'number' && item.zAccelPeak < 0.6) return false;
  return true;
}

function notifyListeners(data: RawDetection[]) {
  listeners.forEach((fn) => {
    try {
      fn(data);
    } catch {
      // Abaikan error listener individual
    }
  });
}

/**
 * Service Penyimpanan Riwayat Deteksi Lokal (In-Memory RAM + AsyncStorage Persistence).
 * Menjamin riwayat telemetri tetap tersimpan di HP dan dapat langsung
 * diakses secara sinkron (0 ms) via useState tanpa harus menunggu roundtrip cloud server.
 */
export const historyStorage = {
  /**
   * Mengambil snapshot cache dari RAM secara sinkron (0 ms) untuk inisialisasi useState.
   */
  getMemoryCache(): RawDetection[] | null {
    return memoryCache;
  },

  /**
   * Mengecek kapan terakhir kali tersinkronisasi dengan backend.
   */
  getLastSyncedAt(): number {
    return lastSyncedAtMs;
  },

  markSynced(): void {
    lastSyncedAtMs = Date.now();
  },

  /**
   * Berlangganan perubahan data riwayat di memori secara reaktif.
   */
  subscribe(listener: HistoryCacheListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Mengambil seluruh data riwayat deteksi yang tersimpan secara lokal di HP.
   */
  async getLocalDetections(): Promise<RawDetection[]> {
    if (memoryCache !== null) {
      return memoryCache;
    }
    try {
      const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        memoryCache = [];
        return [];
      }
      const parsed = JSON.parse(raw);
      const rawList = Array.isArray(parsed) ? parsed : [];
      const list = rawList.filter(isValidAnomalyDetection);
      memoryCache = list;
      if (list.length !== rawList.length) {
        AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list)).catch(() => {});
      }
      notifyListeners(list);
      return list;
    } catch (err) {
      console.warn('[HistoryStorage] Gagal membaca riwayat lokal:', err);
      return memoryCache ?? [];
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

      const existing = memoryCache ?? (await this.getLocalDetections());
      const map = new Map<string, RawDetection>();

      // Masukkan data lama yang valid
      for (const item of existing) {
        if (isValidAnomalyDetection(item)) map.set(item.id, item);
      }

      // Timpa atau tambahkan dengan data terbaru yang valid (anomali nyata saat bergerak)
      for (const item of incoming) {
        if (isValidAnomalyDetection(item)) map.set(item.id, item);
      }

      // Urutkan dari yang paling baru
      const merged = Array.from(map.values()).sort((a, b) => {
        const timeA = new Date(a.detectedAt || 0).getTime();
        const timeB = new Date(b.detectedAt || 0).getTime();
        return timeB - timeA;
      });

      const capped = merged.slice(0, MAX_LOCAL_DETECTIONS);
      memoryCache = capped;
      lastSyncedAtMs = Date.now();
      notifyListeners(capped);

      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(capped));
      return capped;
    } catch (err) {
      console.warn('[HistoryStorage] Gagal menyimpan riwayat lokal:', err);
      return memoryCache ?? incoming.filter(isValidAnomalyDetection);
    }
  },

  /**
   * Menyimpan satu deteksi baru secara instan ke RAM (0ms) lalu persist ke AsyncStorage.
   */
  async addSingleDetection(detection: RawDetection): Promise<void> {
    if (!isValidAnomalyDetection(detection)) {
      return;
    }
    try {
      const base = (memoryCache ?? []).filter(isValidAnomalyDetection);
      const filtered = base.filter((d) => d.id !== detection.id);
      const immediateUpdated = [detection, ...filtered].slice(0, MAX_LOCAL_DETECTIONS);
      memoryCache = immediateUpdated;
      notifyListeners(immediateUpdated);

      const existingDisk = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (existingDisk) {
        const parsed = JSON.parse(existingDisk);
        if (Array.isArray(parsed)) {
          const map = new Map<string, RawDetection>();
          for (const item of parsed) {
            if (isValidAnomalyDetection(item)) map.set(item.id, item);
          }
          for (const item of immediateUpdated) {
            if (isValidAnomalyDetection(item)) map.set(item.id, item);
          }
          const merged = Array.from(map.values())
            .sort(
              (a, b) =>
                new Date(b.detectedAt || 0).getTime() -
                new Date(a.detectedAt || 0).getTime()
            )
            .slice(0, MAX_LOCAL_DETECTIONS);
          memoryCache = merged;
          notifyListeners(merged);
          await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(merged));
          return;
        }
      }

      await AsyncStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(immediateUpdated)
      );
    } catch (err) {
      console.warn('[HistoryStorage] Gagal menambahkan deteksi lokal:', err);
    }
  },

  /**
   * Menghapus cache riwayat lokal (misal saat user logout total).
   */
  async clear(): Promise<void> {
    try {
      memoryCache = [];
      lastSyncedAtMs = 0;
      notifyListeners([]);
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (err) {
      console.warn('[HistoryStorage] Gagal menghapus storage riwayat lokal:', err);
    }
  },
};

// Warm-up cache di background saat modul dimuat
historyStorage.getLocalDetections().catch(() => {});
