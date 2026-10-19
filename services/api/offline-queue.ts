import AsyncStorage from '@react-native-async-storage/async-storage';
import { detectionsService } from './detections.service';
import type { CreateDetectionDto } from '@/types/api';

const OFFLINE_QUEUE_KEY = 'HYPERGRID_OFFLINE_QUEUE_V1';

/**
 * Offline-First Ingestion Queue Manager dengan Penyimpanan Persisten.
 * Menampung deteksi kerusakan jalan saat koneksi internet offline / lemah
 * dan menyimpannya ke disk (AsyncStorage) sehingga aman jika app ditutup / HP mati.
 * Secara otomatis mengirimkannya secara massal (Batch Ingestion) saat online.
 */
class OfflineQueueManager {
  private queue: CreateDetectionDto[] = [];
  private isFlushing = false;
  private maxQueueSize = 500;
  private isLoaded = false;

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.queue = parsed;
        }
      }
    } catch (err) {
      console.warn('[OfflineQueue] Gagal membaca antrean tersimpan:', err);
    } finally {
      this.isLoaded = true;
    }
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      console.warn('[OfflineQueue] Gagal menyimpan antrean:', err);
    }
  }

  /**
   * Menambahkan deteksi ke antrean lokal dan menyimpannya ke storage persisten
   */
  enqueue(detection: CreateDetectionDto): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }
    this.queue.push(detection);
    this.persist();
  }

  /**
   * Menambahkan beberapa deteksi sekaligus ke antrean
   */
  enqueueMany(detections: CreateDetectionDto[]): void {
    for (const d of detections) {
      if (this.queue.length >= this.maxQueueSize) {
        this.queue.shift();
      }
      this.queue.push(d);
    }
    this.persist();
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
    if (!this.isLoaded) {
      await this.loadFromStorage();
    }

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
      await this.persist();
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
  async clear(): Promise<void> {
    this.queue = [];
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY).catch(() => {});
  }
}

export const offlineQueue = new OfflineQueueManager();
