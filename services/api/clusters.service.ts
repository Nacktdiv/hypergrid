import { apiClient } from './client';
import type {
  BoundingBoxFilter,
  PotholeCluster,
  UpdateClusterDto,
  UpdateClusterStatusDto,
} from '@/types/api';

/**
 * Service Modul Klaster Lubang Jalan (`/api/pothole-clusters`).
 * Mengelola hasil agregasi spasial PostGIS untuk visualisasi peta
 * dan early warning driver.
 */
interface CachedClusters {
  data: PotholeCluster[];
  timestamp: number;
  filterKey: string;
}

let clustersCache: CachedClusters | null = null;
const CLUSTERS_CACHE_TTL_MS = 15_000; // 15 detik

export const clustersService = {
  /**
   * Mengambil klaster lubang jalan dalam jendela koordinat peta (Bounding Box)
   * atau filter status / tingkat keparahan dengan TTL caching 15 detik.
   * GET /api/pothole-clusters
   */
  async getClusters(filter?: BoundingBoxFilter): Promise<PotholeCluster[]> {
    const filterKey = JSON.stringify(filter || {});
    const now = Date.now();

    if (
      clustersCache &&
      clustersCache.filterKey === filterKey &&
      now - clustersCache.timestamp < CLUSTERS_CACHE_TTL_MS
    ) {
      return clustersCache.data;
    }

    const data = await apiClient.get<PotholeCluster[]>('/pothole-clusters', {
      params: {
        minLat: filter?.minLat,
        minLon: filter?.minLon,
        maxLat: filter?.maxLat,
        maxLon: filter?.maxLon,
        status: filter?.status,
        severity: filter?.severity,
        limit: filter?.limit,
      },
    });

    clustersCache = { data: data || [], timestamp: now, filterKey };
    return data || [];
  },

  /**
   * Cek Lubang Terdekat / Driver Early Warning.
   * Digunakan oleh mobile app untuk mendeteksi apakah terdapat lubang jalan
   * dalam radius N meter di depan kendaraan.
   * GET /api/pothole-clusters/nearby?lat=...&lon=...&radius=...
   */
  async checkNearby(
    lat: number,
    lon: number,
    radiusMeters: number = 15
  ): Promise<PotholeCluster | null> {
    const data = await apiClient.get<PotholeCluster | null>('/pothole-clusters/nearby', {
      params: {
        lat,
        lon,
        radius: radiusMeters,
      },
    });
    return data || null;
  },

  /**
   * Mengambil detail satu klaster kerusakan jalan berdasarkan UUID.
   * GET /api/pothole-clusters/:id
   */
  async getClusterById(id: string): Promise<PotholeCluster> {
    return apiClient.get<PotholeCluster>(`/pothole-clusters/${encodeURIComponent(id)}`);
  },

  /**
   * Memperbarui status verifikasi dinas PU atau verifikator lapangan.
   * PATCH /api/pothole-clusters/:id/status
   */
  async updateStatus(
    id: string,
    dto: UpdateClusterStatusDto
  ): Promise<PotholeCluster> {
    return apiClient.patch<PotholeCluster>(
      `/pothole-clusters/${encodeURIComponent(id)}/status`,
      dto
    );
  },

  /**
   * Memperbarui atribut klaster menyeluruh.
   * PATCH /api/pothole-clusters/:id
   */
  async updateCluster(
    id: string,
    dto: UpdateClusterDto
  ): Promise<PotholeCluster> {
    return apiClient.patch<PotholeCluster>(
      `/pothole-clusters/${encodeURIComponent(id)}`,
      dto
    );
  },

  /**
   * Menghapus klaster lubang jalan dari basis data PostGIS.
   * DELETE /api/pothole-clusters/:id
   */
  async deleteCluster(
    id: string
  ): Promise<{ success: boolean; id: string }> {
    return apiClient.delete<{ success: boolean; id: string }>(
      `/pothole-clusters/${encodeURIComponent(id)}`
    );
  },
};
