import { detectionsService } from './detections.service';
import type { CreateDetectionDto } from '@/types/api';

/**
 * Offline-First Ingestion Queue Manager.
 * Menampung deteksi kerusakan jalan saat koneksi internet offline / lemah,
 * dan secara otomatis mengirimkannya secara massal (Batch Ingestion) saat online.
 */

class OfflineQueueManager {
  private queue: CreateDetectionDto[] = [];
  private isFlushing = false;
  private maxQueueSize = 500;

  /**
   * Menambahkan deteksi ke antrean lokal
   */
  enqueue(detection: CreateDetectionDto): void {
    if (this.queue.length >= this.maxQueueSize) {
      // Buang data terlama jika antrean melebihi batas kapasitas
      this.queue.shift();
    }
    this.queue.push(detection);
  }

  /**
   * Menambahkan beberapa deteksi sekaligus ke antrean
   */
  enqueueMany(detections: CreateDetectionDto[]): void {
    for (const d of detections) {
      this.enqueue(d);
    }
  }

  /**
   * Mendapatkan ukuran antrean saat ini
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Mengambil semua item dalam antrean saat ini
   */
  getItems(): CreateDetectionDto[] {
    return [...this.queue];
  }

  /**
   * Mengirim seluruh antrean ke endpoint Batch Ingestion (`POST /api/detections/batch`)
   */
  async flush(): Promise<{ uploaded: number; remaining: number }> {
    if (this.isFlushing || this.queue.length === 0) {
      return { uploaded: 0, remaining: this.queue.length };
    }

    this.isFlushing = true;
    const batchToSend = [...this.queue];

    try {
      const response = await detectionsService.createBatchDetections({
        detections: batchToSend,
      });

      // Jika berhasil, keluarkan data yang telah terkirim
      const uploadedCount = response?.count ?? batchToSend.length;
      this.queue.splice(0, batchToSend.length);
      return { uploaded: uploadedCount, remaining: this.queue.length };
    } catch (error) {
      console.warn('[OfflineQueue] Gagal melakukan flush batch detection:', error);
      return { uploaded: 0, remaining: this.queue.length };
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Membersihkan antrean
   */
  clear(): void {
    this.queue = [];
  }
}

export const offlineQueue = new OfflineQueueManager();
