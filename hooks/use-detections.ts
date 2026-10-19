import { useCallback, useEffect, useState } from 'react';
import { detectionsService } from '@/services/api/detections.service';
import { offlineQueue } from '@/services/api/offline-queue';
import { historyStorage } from '@/services/api/history-storage';
import type { CreateDetectionDto, DetectionsQueryFilter, RawDetection } from '@/types/api';

/**
 * Hook Manajemen Riwayat Deteksi Mentah dan Sinkronisasi Telemetri.
 * Menggunakan strategi Stale-While-Revalidate: memuat data lokal instan
 * lalu menyinkronkan dengan data cloud server secara asinkron.
 */
export function useDetections() {
  const [detections, setDetections] = useState<RawDetection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState<number>(offlineQueue.size());

  // 1. Muat riwayat lokal seketika saat hook dipasang (0 ms initial latency)
  useEffect(() => {
    historyStorage.getLocalDetections().then((cached) => {
      if (cached && cached.length > 0) {
        setDetections((prev) => (prev.length === 0 ? cached : prev));
      }
    });
  }, []);

  /**
   * Mengambil log deteksi dari server dengan fallback ke local cache
   */
  const fetchDetections = useCallback(async (filter?: DetectionsQueryFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await detectionsService.getDetections(filter);
      if (data && data.length > 0) {
        // Simpan & gabungkan data terbaru ke penyimpanan lokal
        const merged = await historyStorage.saveDetections(data);
        setDetections(merged);
        return merged;
      } else {
        // Jika server mengembalikan array kosong, gunakan data lokal yang ada
        const cached = await historyStorage.getLocalDetections();
        if (cached.length > 0) {
          setDetections(cached);
          return cached;
        }
        setDetections([]);
        return [];
      }
    } catch (err: any) {
      const msg = err.message || 'Gagal memuat daftar deteksi dari server';
      setError(msg);
      // Fallback ke penyimpanan lokal saat offline / cold-start
      const fallback = await historyStorage.getLocalDetections();
      if (fallback.length > 0) {
        setDetections(fallback);
        return fallback;
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mengambil riwayat deteksi berdasarkan deviceId
   */
  const fetchDeviceDetections = useCallback(async (deviceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await detectionsService.getDeviceDetections(deviceId);
      if (data && data.length > 0) {
        const merged = await historyStorage.saveDetections(data);
        setDetections(merged);
        return merged;
      }
      return await historyStorage.getLocalDetections();
    } catch (err: any) {
      const msg = err.message || 'Gagal memuat riwayat deteksi perangkat';
      setError(msg);
      return await historyStorage.getLocalDetections();
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mengambil riwayat deteksi khusus akun user
   */
  const fetchUserDetections = useCallback(async (userId: string, limit = 100) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await detectionsService.getUserDetections(userId, limit);
      if (data && data.length > 0) {
        const merged = await historyStorage.saveDetections(data);
        setDetections(merged);
        return merged;
      }
      return await historyStorage.getLocalDetections();
    } catch (err: any) {
      const msg = err.message || 'Gagal memuat riwayat deteksi pengguna';
      setError(msg);
      return await historyStorage.getLocalDetections();
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mengirim single detection
   */
  const submitDetection = async (dto: CreateDetectionDto) => {
    try {
      const created = await detectionsService.createDetection(dto);
      await historyStorage.addSingleDetection(created);
      setDetections((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      // Masukkan ke offline queue jika gagal kirim langsung
      offlineQueue.enqueue(dto);
      setQueueCount(offlineQueue.size());
      throw err;
    }
  };

  /**
   * Sinkronisasi antrean offline ke server via batch ingestion
   */
  const syncOfflineQueue = async () => {
    setIsSyncing(true);
    try {
      const res = await offlineQueue.flush();
      setQueueCount(res.remaining);
      return res;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    detections,
    isLoading,
    isSyncing,
    error,
    queueCount,
    fetchDetections,
    fetchDeviceDetections,
    fetchUserDetections,
    submitDetection,
    syncOfflineQueue,
  };
}
