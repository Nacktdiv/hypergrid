import { useCallback, useState } from 'react';
import { detectionsService } from '@/services/api/detections.service';
import { offlineQueue } from '@/services/api/offline-queue';
import type { CreateDetectionDto, DetectionsQueryFilter, RawDetection } from '@/types/api';

/**
 * Hook Manajemen Riwayat Deteksi Mentah dan Sinkronisasi Telemetri.
 */
export function useDetections() {
  const [detections, setDetections] = useState<RawDetection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState<number>(offlineQueue.size());

  /**
   * Mengambil log deteksi dari server
   */
  const fetchDetections = useCallback(async (filter?: DetectionsQueryFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await detectionsService.getDetections(filter);
      setDetections(data);
      return data;
    } catch (err: any) {
      const msg = err.message || 'Gagal memuat daftar deteksi';
      setError(msg);
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
      setDetections(data);
      return data;
    } catch (err: any) {
      const msg = err.message || 'Gagal memuat riwayat deteksi perangkat';
      setError(msg);
      return [];
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
      setDetections(data);
      return data;
    } catch (err: any) {
      const msg = err.message || 'Gagal memuat riwayat deteksi pengguna';
      setError(msg);
      return [];
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
