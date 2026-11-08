import { apiClient } from './client';
import {
  parseClusterSeverity,
  type BoundingBoxFilter,
  type DbscanClustersResponse,
  type PotholeCluster,
  type UpdateClusterDto,
  type UpdateClusterStatusDto,
} from '@/types/api';

/**
 * Service Modul Klaster Lubang Jalan (`/api/pothole-clusters`).
 * Mengelola hasil agregasi spasial PostGIS & DBSCAN untuk visualisasi peta
 * dan early warning driver.
 */
interface CachedClusters {
  data: PotholeCluster[];
  timestamp: number;
  filterKey: string;
}

interface CachedDbscan {
  data: DbscanClustersResponse;
  timestamp: number;
  filterKey: string;
}

let clustersCache: CachedClusters | null = null;
let dbscanCache: CachedDbscan | null = null;
const CLUSTERS_CACHE_TTL_MS = 15_000; // 15 detik

export const clustersService = {
  /**
   * Mengambil klaster konsolidasi DBSCAN lintas pengguna dan data heatmap global.
   * GET /api/pothole-clusters/dbscan
   */
  async getDbscanClusters(
    filter?: BoundingBoxFilter & { eps?: number; minPts?: number },
    forceRefresh = false
  ): Promise<DbscanClustersResponse> {
    const filterKey = JSON.stringify(filter || {});
    const now = Date.now();

    if (
      !forceRefresh &&
      dbscanCache &&
      dbscanCache.filterKey === filterKey &&
      now - dbscanCache.timestamp < CLUSTERS_CACHE_TTL_MS
    ) {
      return dbscanCache.data;
    }

    try {
      const response = await apiClient.get<DbscanClustersResponse | PotholeCluster[]>(
        '/pothole-clusters/dbscan',
        {
          params: {
            eps: filter?.eps ?? 100,
            minPts: filter?.minPts ?? 1,
            vehicleType: filter?.vehicleType,
            minLat: filter?.minLat,
            minLon: filter?.minLon,
            maxLat: filter?.maxLat,
            maxLon: filter?.maxLon,
            status: filter?.status,
            severity: filter?.severity,
            limit: filter?.limit,
          },
        }
      );

      let result: DbscanClustersResponse;
      if (Array.isArray(response)) {
        // Fallback jika respons lama berupa array klaster
        const mappedClusters: PotholeCluster[] = response.map((c) => ({
          ...c,
          severity: parseClusterSeverity(c.severity),
        }));
        result = {
          clusters: mappedClusters,
          heatmap: response.map((c) => [c.center_latitude, c.center_longitude, c.confidence_avg || 0.6]),
          total_detections: response.reduce((sum, c) => sum + (c.detection_count || 1), 0),
          total_clusters: response.length,
          generated_at: new Date().toISOString(),
        };
      } else {
        result = {
          ...response,
          clusters: (response.clusters || []).map((c) => ({
            ...c,
            severity: parseClusterSeverity(c.severity),
          })),
        };
      }

      dbscanCache = { data: result, timestamp: now, filterKey };
      clustersCache = { data: result.clusters || [], timestamp: now, filterKey };
      return result;
    } catch (error) {
      // Jika endpoint /dbscan gagal (misal server belum direstart), coba fallback ke /pothole-clusters?includeHeatmap=true
      console.warn('[clustersService] /dbscan fallback ke /pothole-clusters?includeHeatmap=true:', error);
      const fallback = await apiClient.get<any>('/pothole-clusters', {
        params: {
          includeHeatmap: 'true',
          minLat: filter?.minLat,
          minLon: filter?.minLon,
          maxLat: filter?.maxLat,
          maxLon: filter?.maxLon,
          status: filter?.status,
          severity: filter?.severity,
          limit: filter?.limit,
        },
      });

      let res: DbscanClustersResponse;
      if (Array.isArray(fallback)) {
        const mappedFallback: PotholeCluster[] = fallback.map((c: any) => ({
          ...c,
          severity: parseClusterSeverity(c.severity),
        }));
        res = {
          clusters: mappedFallback,
          heatmap: fallback.map((c: any) => [c.center_latitude, c.center_longitude, c.confidence_avg || 0.6]),
          total_detections: fallback.reduce((s: number, c: any) => s + (c.detection_count || 1), 0),
          total_clusters: fallback.length,
          generated_at: new Date().toISOString(),
        };
      } else {
        res = {
          ...fallback,
          clusters: (fallback.clusters || []).map((c: any) => ({
            ...c,
            severity: parseClusterSeverity(c.severity),
          })),
        };
      }

      dbscanCache = { data: res, timestamp: now, filterKey };
      clustersCache = { data: res.clusters || [], timestamp: now, filterKey };
      return res;
    }
  },

  /**
   * Mengambil klaster lubang jalan dalam jendela koordinat peta (Bounding Box)
   * atau filter status / tingkat keparahan dengan TTL caching 15 detik.
   * GET /api/pothole-clusters
   */
  async getClusters(filter?: BoundingBoxFilter, forceRefresh = false): Promise<PotholeCluster[]> {
    const filterKey = JSON.stringify(filter || {});
    const now = Date.now();

    if (
      !forceRefresh &&
      clustersCache &&
      clustersCache.filterKey === filterKey &&
      now - clustersCache.timestamp < CLUSTERS_CACHE_TTL_MS
    ) {
      return clustersCache.data;
    }

    const data = await apiClient.get<PotholeCluster[] | DbscanClustersResponse>('/pothole-clusters', {
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

    const rawClusters = Array.isArray(data) ? data : data?.clusters || [];
    const clusters: PotholeCluster[] = rawClusters.map((c) => ({
      ...c,
      severity: parseClusterSeverity(c.severity),
    }));
    clustersCache = { data: clusters, timestamp: now, filterKey };
    return clusters;
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
    if (!data) return null;
    return {
      ...data,
      severity: parseClusterSeverity(data.severity),
    };
  },

  /**
   * Mengambil detail satu klaster kerusakan jalan berdasarkan UUID.
   * GET /api/pothole-clusters/:id
   */
  async getClusterById(id: string): Promise<PotholeCluster> {
    const cluster = await apiClient.get<PotholeCluster>(`/pothole-clusters/${encodeURIComponent(id)}`);
    return {
      ...cluster,
      severity: parseClusterSeverity(cluster.severity),
    };
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
