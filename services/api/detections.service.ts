import { apiClient } from './client';
import type {
  CreateBatchDetectionDto,
  CreateDetectionDto,
  DetectionsQueryFilter,
  RawDetection,
  BatchDetectionResponse,
} from '@/types/api';

/**
 * Service Modul Deteksi Mentah (`/api/detections`).
 * Mengelola pengiriman telemetri IoT / sensor dan riwayat pembacaan jalan rusak.
 */
export const detectionsService = {
  /**
   * Mengirim 1 data deteksi baru (Single Ingestion).
   * Backend otomatis melakukan agregasi spasial 15m ke `pothole_clusters`.
   * POST /api/detections
   */
  async createDetection(dto: CreateDetectionDto): Promise<RawDetection> {
    return apiClient.post<RawDetection>('/detections', dto);
  },

  /**
   * Mengirim kumpulan data deteksi sekaligus (Bulk / Batch Ingestion).
   * Digunakan terutama saat perangkat kembali online setelah offline mode.
   * POST /api/detections/batch
   */
  async createBatchDetections(
    dto: CreateBatchDetectionDto
  ): Promise<BatchDetectionResponse> {
    return apiClient.post<BatchDetectionResponse>('/detections/batch', dto);
  },

  /**
   * Mengambil daftar log deteksi mentah dengan opsi filter.
   * GET /api/detections?limit=...&search=...&deviceId=...&userId=...
   */
  async getDetections(filter?: DetectionsQueryFilter): Promise<RawDetection[]> {
    return apiClient.get<RawDetection[]>('/detections', {
      params: {
        limit: filter?.limit,
        search: filter?.search,
        deviceId: filter?.deviceId,
        userId: filter?.userId,
      },
    });
  },

  /**
   * Mengambil riwayat deteksi khusus akun user tertentu.
   * GET /api/detections/user/:userId
   */
  async getUserDetections(
    userId: string,
    limit = 100
  ): Promise<RawDetection[]> {
    return apiClient.get<RawDetection[]>(
      `/detections/user/${encodeURIComponent(userId)}`,
      { params: { limit } }
    );
  },

  /**
   * Mengambil riwayat deteksi terakhir khusus satu perangkat.
   * GET /api/detections/device/:deviceId
   */
  async getDeviceDetections(deviceId: string): Promise<RawDetection[]> {
    return apiClient.get<RawDetection[]>(`/detections/device/${encodeURIComponent(deviceId)}`);
  },

  /**
   * Mengambil detail satu data deteksi berdasarkan UUID.
   * GET /api/detections/:id
   */
  async getDetectionById(id: string): Promise<RawDetection> {
    return apiClient.get<RawDetection>(`/detections/${encodeURIComponent(id)}`);
  },

  /**
   * Memperbarui atribut record deteksi mentah.
   * PATCH /api/detections/:id
   */
  async updateDetection(
    id: string,
    data: Partial<CreateDetectionDto>
  ): Promise<RawDetection> {
    return apiClient.patch<RawDetection>(`/detections/${encodeURIComponent(id)}`, data);
  },

  /**
   * Menghapus record deteksi mentah.
   * DELETE /api/detections/:id
   */
  async deleteDetection(id: string): Promise<RawDetection> {
    return apiClient.delete<RawDetection>(`/detections/${encodeURIComponent(id)}`);
  },
};
