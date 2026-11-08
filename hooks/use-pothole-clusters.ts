import { useCallback, useState } from 'react';
import { clustersService } from '@/services/api/clusters.service';
import type {
  BoundingBoxFilter,
  PotholeCluster,
  UpdateClusterStatusDto,
} from '@/types/api';

let memoryClustersCache: PotholeCluster[] | null = null;
let memoryHeatmapCache: [number, number, number][] = [];
let lastClustersFetchMs = 0;

/**
 * Hook Manajemen Klaster Lubang Jalan, DBSCAN Consolidation & Early Warning PostGIS.
 * Menyimpan cache klaster & heatmap di memori agar perpindahan antar tab berlangsung instan (0 ms).
 */
export function usePotholeClusters() {
  const [clusters, setClusters] = useState<PotholeCluster[]>(
    () => memoryClustersCache ?? []
  );
  const [heatmap, setHeatmap] = useState<[number, number, number][]>(
    () => memoryHeatmapCache ?? []
  );
  const [nearbyCluster, setNearbyCluster] = useState<PotholeCluster | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(
    () => memoryClustersCache === null
  );
  const [error, setError] = useState<string | null>(null);

  /**
   * Mengambil data klaster DBSCAN dan heatmap global
   */
  const fetchDbscanClusters = useCallback(
    async (
      filter?: BoundingBoxFilter & { eps?: number; minPts?: number },
      force = false
    ) => {
      if (
        !force &&
        memoryClustersCache !== null &&
        Date.now() - lastClustersFetchMs < 30_000
      ) {
        setClusters(memoryClustersCache);
        setHeatmap(memoryHeatmapCache);
        setIsLoading(false);
        return { clusters: memoryClustersCache, heatmap: memoryHeatmapCache };
      }

      if (memoryClustersCache === null) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const data = await clustersService.getDbscanClusters(filter, force);
        memoryClustersCache = data.clusters || [];
        memoryHeatmapCache = data.heatmap || [];
        lastClustersFetchMs = Date.now();
        setClusters(memoryClustersCache);
        setHeatmap(memoryHeatmapCache);
        return data;
      } catch (err: any) {
        const msg = err.message || 'Gagal memuat klaster DBSCAN';
        setError(msg);
        return {
          clusters: memoryClustersCache ?? [],
          heatmap: memoryHeatmapCache ?? [],
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Mengambil data klaster berdasarkan bounding box viewport atau filter
   * (Secara default menggunakan endpoint DBSCAN agar titik terakumulasi dan heatmap siap)
   */
  const fetchClusters = useCallback(async (filter?: BoundingBoxFilter, force = false) => {
    return fetchDbscanClusters(filter, force).then((res) => res.clusters);
  }, [fetchDbscanClusters]);

  /**
   * Cek klaster lubang terdekat untuk early warning peringatan driver
   */
  const checkNearby = useCallback(async (lat: number, lon: number, radiusMeters = 20) => {
    try {
      const data = await clustersService.checkNearby(lat, lon, radiusMeters);
      setNearbyCluster((prev) => {
        if (!prev && !data) return null;
        if (
          prev &&
          data &&
          prev.id === data.id &&
          Math.abs((prev.distance_meters ?? 0) - (data.distance_meters ?? 0)) < 2
        ) {
          return prev;
        }
        return data;
      });
      return data;
    } catch (err: any) {
      console.warn('[usePotholeClusters] Gagal cek nearby:', err);
      return null;
    }
  }, []);

  /**
   * Update status klaster (misal oleh dinas PU atau verifikator)
   */
  const updateStatus = async (id: string, dto: UpdateClusterStatusDto) => {
    try {
      const updated = await clustersService.updateStatus(id, dto);
      setClusters((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
      );
      return updated;
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah status');
      throw err;
    }
  };

  return {
    clusters,
    heatmap,
    nearbyCluster,
    isLoading,
    error,
    fetchClusters,
    fetchDbscanClusters,
    checkNearby,
    updateStatus,
  };
}
