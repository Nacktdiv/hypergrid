import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InteractionManager,
  Modal,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  Database,
  Layers,
  MapPin,
  ShieldAlert,
  X,
  ZoomIn,
} from "lucide-react-native";

import { LeafletMap } from "@/components/map/leaflet-map";
import {
  type AreaSummary,
  type DamagePoint,
  type LatLng,
  type MapData,
} from "@/components/map/map-data";
import { MapCanvasSkeleton } from "@/components/ui/skeleton";
import { Touchable } from "@/components/ui/touchable";
import { ClusterRadialCard } from "./cluster-radial-card";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";
import { useUserLocation } from "@/hooks/use-user-location";
import type { PotholeCluster, PotholeStatus } from "@/types/api";
import { type VehicleId } from "@/contexts/vehicle-context";

type FilterStatus = "all" | PotholeStatus;

/**
 * Peta utama interaktif — Leaflet + OpenStreetMap.
 *
 * Dilengkapi:
 *   - Transisi masuk instan dengan Skeleton Loader saat memuat data klaster & GPS
 *   - Ikon lokasi marker dinamis (Mobil / Motor / Sepeda)
 *   - Menampilkan seluruh klaster PostGIS publik dari database (bukan hanya history user)
 *   - Filter chip status klaster (Semua, Aktif, Terverifikasi, Selesai)
 *   - Multi-Level LOD:
 *     * Level Jauh (zoom < 14): Titik Ringkasan Ruas Jalan Makro (~1 km) + Modal Ringkasan Area
 *     * Level Agak Jauh (14 <= zoom < 16): Heatmap Seruas Jalan Saja
 *     * Level Dekat (zoom >= 16): Titik-titik Klaster Representatif + Modal Road Damage Details
 */
export type MainMapProps = {
  vehicleId: VehicleId;
  fullBleed?: boolean;
  showOverlayControls?: boolean;
  onOpenClusterDetail?: (cluster: PotholeCluster) => void;
  currentCoords?: LatLng | null;
  plannedRoute?: LatLng[];
};

export function MainMap({
  vehicleId,
  fullBleed = false,
  showOverlayControls = true,
  onOpenClusterDetail,
  currentCoords: externalCoords,
  plannedRoute,
}: MainMapProps) {
  const {
    clusters,
    heatmap,
    isLoading: isClustersLoading,
    fetchClusters,
  } = usePotholeClusters();
  const hasExternalCoords = externalCoords !== undefined;
  const {
    coords: internalCoords,
    getImmediateLocation,
    errorMsg,
  } = useUserLocation(false, { enabled: !hasExternalCoords });

  const liveCoords = hasExternalCoords ? externalCoords : internalCoords;

  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [selectedCluster, setSelectedCluster] = useState<PotholeCluster | null>(
    null
  );
  const [isClusterModalVisible, setIsClusterModalVisible] = useState(false);
  const [selectedArea, setSelectedArea] = useState<AreaSummary | null>(null);
  const [isAreaModalVisible, setIsAreaModalVisible] = useState(false);
  const [focusCoords, setFocusCoords] = useState<{
    latitude: number;
    longitude: number;
    zoom?: number;
  } | null>(null);

  const [hasFetchedInitial, setHasFetchedInitial] = useState(
    () => clusters.length > 0 || !isClustersLoading
  );

  const loadInitialClusters = useCallback(async () => {
    try {
      await fetchClusters({ limit: 500, eps: 100, minPts: 2, vehicleType: vehicleId });
    } finally {
      setHasFetchedInitial(true);
    }
  }, [fetchClusters, vehicleId]);

  // Ambil seluruh klaster lubang jalan nyata di database setelah transisi halaman selesai
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadInitialClusters();
    });
    return () => task.cancel();
  }, [loadInitialClusters]);

  // Filter klaster berdasarkan tab yang dipilih
  const filteredClusters = useMemo(() => {
    if (activeFilter === "all") return clusters;
    return clusters.filter((c) => c.status === activeFilter);
  }, [clusters, activeFilter]);

  const mapData: MapData = useMemo(() => {
    const baseCenter = liveCoords || { latitude: -6.2088, longitude: 106.8456 };

    // Titik representatif tunggal hasil konsolidasi DBSCAN lintas pengguna
    const liveDamagePoints: DamagePoint[] = filteredClusters.map((c) => ({
      id: c.id,
      position: {
        latitude: c.center_latitude,
        longitude: c.center_longitude,
      },
      severity: c.severity,
      reportCount: c.detection_count,
      radius_meters: c.radius_meters || 18,
      road_length_meters: c.road_length_meters || 15,
      road_segment_coords: c.road_segment_coords?.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      })),
      userCount: c.user_count || 1,
      points: c.points?.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        intensity: p.intensity,
      })),
    }));

    return {
      camera: {
        latitude: baseCenter.latitude,
        longitude: baseCenter.longitude,
        zoom: 15,
      },
      route: { id: "user-route", coordinates: plannedRoute || [] },
      damagePoints: liveDamagePoints,
      heatmap: heatmap || [],
      activeClusterId: selectedCluster?.id ?? null,
      activeAreaId: selectedArea?.id ?? null,
      userLocation: baseCenter,
      vehiclePosition: baseCenter,
    };
  }, [filteredClusters, liveCoords, heatmap, selectedCluster?.id, selectedArea?.id, plannedRoute]);

  // Handler KLIK KEDUA (Re-click pada pin yang sedang aktif) -> Baru buka modal Road Damage Details
  const handleMarkerPress = (point: DamagePoint) => {
    const found = clusters.find((c) => c.id === point.id);
    if (found) {
      setSelectedCluster(found);
      setIsClusterModalVisible(true);
      onOpenClusterDetail?.(found);
    }
  };

  // Handler KLIK PERTAMA (Pemilihan titik pertama kali) -> Tampilkan koridor ruas jalan & pin kerusakan TANPA buka modal
  const handlePointSelected = (point: DamagePoint, area?: AreaSummary) => {
    const found = clusters.find((c) => c.id === point.id);
    if (found) {
      setSelectedCluster(found);
    }
    if (area) {
      setSelectedArea(area);
    }
  };

  // Handler Reset Seleksi saat user klik di area kosong peta
  const handleClearSelection = () => {
    setSelectedCluster(null);
    setSelectedArea(null);
    setIsAreaModalVisible(false);
    setIsClusterModalVisible(false);
  };

  if (!liveCoords || (!hasFetchedInitial && isClustersLoading)) {
    return (
      <View
        className={
          fullBleed
            ? "flex-1 w-full h-full items-center justify-center bg-slate-100"
            : "flex-1 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
        }
        style={fullBleed ? { width: "100%", height: "100%" } : { height: 340, width: "100%" }}
      >
        {errorMsg ? (
          <View className="items-center gap-2 p-4">
            <ShieldAlert size={28} color="#F59E0B" />
            <Text className="text-center font-quicksand-bold text-xs text-slate-800">
              {errorMsg}
            </Text>
            <Touchable
              onPress={() => getImmediateLocation()}
              className="mt-2 rounded-xl bg-sky-500 px-4 py-2"
            >
              <Text className="font-quicksand-bold text-xs text-white">
                Coba Lagi
              </Text>
            </Touchable>
          </View>
        ) : (
          <MapCanvasSkeleton />
        )}
      </View>
    );
  }

  return (
    <View
      className={
        fullBleed
          ? "flex-1 w-full h-full overflow-hidden"
          : "flex-1 w-full overflow-hidden rounded-2xl border border-[#CAD5E2]"
      }
      style={fullBleed ? { width: "100%", height: "100%" } : { height: 340, width: "100%" }}
    >
      <LeafletMap
        data={mapData}
        vehicleType={vehicleId}
        focusCoords={focusCoords}
        onDamagePress={handleMarkerPress}
        onPointSelected={handlePointSelected}
        onClearSelection={handleClearSelection}
        onAreaSummaryPress={(area) => setSelectedArea(area)}
      />

      {showOverlayControls ? (
        <>
          {/* SWISS DESIGN GPS LIVE TELEMETRY BADGE */}
          <View className="absolute bottom-3 left-3 flex-row items-center gap-1.5 rounded-md border border-slate-900 bg-slate-950/90 px-2.5 py-1 shadow-md">
            <View className={`h-2 w-2 rounded-full ${liveCoords ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <Text className="font-mono text-[9px] font-bold uppercase tracking-wider text-white">
              GPS {liveCoords ? `${liveCoords.latitude.toFixed(4)}, ${liveCoords.longitude.toFixed(4)}` : "SEARCHING COORDINATES..."}
            </Text>
          </View>

          {/* RE-CENTER GPS BUTTON */}
          <Touchable
            className="absolute bottom-3 right-3"
            onPress={() => getImmediateLocation()}
          >
            <View className="flex-row items-center gap-1 rounded-md border border-slate-900 bg-white/95 px-2 py-1 shadow-md">
              <MapPin size={11} color="#0F172A" />
              <Text className="font-mono-bold text-[9px] uppercase tracking-wider text-slate-900">
                My Location
              </Text>
            </View>
          </Touchable>
        </>
      ) : null}

      {showOverlayControls ? (
        /* FLOATING STATUS BADGE POSTGIS & FILTER CHIPS */
        <View className="absolute inset-x-3 top-3 gap-2">
          <View className="flex-row items-center justify-between">
            {/* Status Badge */}
            <View className="self-start flex-row items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-2.5 py-1 shadow-sm backdrop-blur-md">
              <Database size={12} color="#009EFF" />
              <Text className="font-mono text-[10px] text-slate-700">
                {clusters.length > 0
                  ? `DBSCAN: ${filteredClusters.length} Clusters • ${heatmap?.length || 0} Heatpoints`
                  : "No Clusters Nearby"}
              </Text>
            </View>
          </View>

          {/* Filter Chips Horizontal Bar */}
          <View className="flex-row gap-1.5">
            <FilterChip
              active={activeFilter === "all"}
              label="All"
              onPress={() => setActiveFilter("all")}
            />
            <FilterChip
              active={activeFilter === "active"}
              label="Active"
              onPress={() => setActiveFilter("active")}
            />
            <FilterChip
              active={activeFilter === "verified"}
              label="Verified"
              onPress={() => setActiveFilter("verified")}
            />
            <FilterChip
              active={activeFilter === "repaired"}
              label="Repaired"
              onPress={() => setActiveFilter("repaired")}
            />
          </View>
        </View>
      ) : null}

      {/* ROAD DAMAGE CLUSTER DETAIL MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={isClusterModalVisible && Boolean(selectedCluster)}
        onRequestClose={() => setIsClusterModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-[32px] bg-white p-6 border-t border-slate-200/80 shadow-lg">
            {selectedCluster ? (
              <View className="gap-3.5">
                {/* Header */}
                <View className="flex-row items-center justify-between pb-1">
                  <View className="flex-row items-center gap-2">
                    <ShieldAlert size={22} color="#EF4444" />
                    <Text className="font-chivo-bold text-lg text-slate-900">
                      Road Damage Details
                    </Text>
                  </View>
                  <Touchable
                    onPress={() => setIsClusterModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Close road damage details"
                  >
                    <View className="rounded-full bg-slate-100 p-1.5">
                      <X size={18} color="#64748B" />
                    </View>
                  </Touchable>
                </View>

                {/* Radial Assessment Card */}
                <ClusterRadialCard cluster={selectedCluster} />

                {/* Official Public Works Status Notice (Read-only for Mobile Users) */}
                <View className="rounded-xl border border-slate-200/90 bg-slate-50 p-3 mt-0.5">
                  <View className="flex-row items-center gap-1.5">
                    <ShieldAlert size={14} color="#64748B" />
                    <Text className="font-quicksand-bold text-[11px] text-slate-800">
                      Public Road Hazard Data
                    </Text>
                  </View>
                  <Text className="mt-1 font-quicksand text-[11px] leading-relaxed text-slate-600">
                    Verification, work orders, and road repairs are managed exclusively by the Public Works Department (Dinas PU) via the Web Admin Dashboard.
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* FLOATING ROAD SEGMENT CARD: Muncul saat Ruas Panjang Jalan Diklik di Peta */}
      {selectedArea ? (
        <View className="absolute bottom-12 inset-x-3 rounded-2xl bg-slate-950/95 border border-slate-700/80 p-3.5 shadow-2xl backdrop-blur-md">
          <View className="flex-row items-center justify-between pb-1.5 border-b border-slate-800">
            <View className="flex-row items-center gap-2">
              <View className="rounded-lg bg-sky-500/20 p-1.5">
                <Layers size={16} color="#009EFF" />
              </View>
              <View>
                <Text className="font-chivo-bold text-sm text-white">
                  Ruas Jalan: {selectedArea.roadLengthMeters >= 1000 ? `${(selectedArea.roadLengthMeters / 1000).toFixed(1)} km` : `${selectedArea.roadLengthMeters} m`}
                </Text>
                <Text className="font-quicksand text-[10px] text-slate-400">
                  {selectedArea.clusterCount} Titik Kerusakan • {selectedArea.totalReports} Laporan
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              <View
                className={`rounded-full px-2 py-0.5 ${
                  selectedArea.worstSeverity === "severe"
                    ? "bg-red-900/80 border border-red-500"
                    : selectedArea.worstSeverity === "high"
                    ? "bg-red-800/80 border border-red-400"
                    : selectedArea.worstSeverity === "medium"
                    ? "bg-amber-800/80 border border-amber-400"
                    : "bg-yellow-800/80 border border-yellow-400"
                }`}
              >
                <Text className="font-quicksand-bold text-[9px] uppercase text-white">
                  {selectedArea.worstSeverity}
                </Text>
              </View>
              <Touchable
                onPress={() => {
                  setSelectedArea(null);
                  setSelectedCluster(null);
                  setIsAreaModalVisible(false);
                  setIsClusterModalVisible(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Tutup highlight ruas jalan"
              >
                <View className="rounded-full bg-slate-800 p-1">
                  <X size={15} color="#94A3B8" />
                </View>
              </Touchable>
            </View>
          </View>

          <View className="flex-row items-center justify-between pt-2">
            <Text className="font-quicksand text-[10px] text-sky-400 flex-1 mr-2">
              📍 Ketuk pin lokasi di ruas jalan untuk melihat detail kerusakan
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Touchable
                onPress={() => setIsAreaModalVisible(true)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5"
              >
                <Text className="font-quicksand-bold text-[10px] text-slate-200">
                  Rincian
                </Text>
              </Touchable>
              <Touchable
                onPress={() => {
                  setFocusCoords({
                    latitude: selectedArea.center.latitude,
                    longitude: selectedArea.center.longitude,
                    zoom: 17.5,
                  });
                }}
                className="flex-row items-center gap-1 rounded-xl bg-custom-primary px-3 py-1.5"
              >
                <ZoomIn size={12} color="#ffffff" />
                <Text className="font-quicksand-bold text-[10px] text-white">
                  Perbesar
                </Text>
              </Touchable>
            </View>
          </View>
        </View>
      ) : null}

      {/* ROAD SEGMENT DETAILED MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={isAreaModalVisible && Boolean(selectedArea)}
        onRequestClose={() => setIsAreaModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-[32px] bg-white p-6 border-t border-slate-200/80 shadow-lg max-h-[85%]">
            {selectedArea ? (
              <View className="gap-4">
                {/* Header */}
                <View className="flex-row items-center justify-between pb-1">
                  <View className="flex-row items-center gap-2.5">
                    <View className="rounded-xl bg-sky-100 p-2">
                      <Layers size={20} color="#009EFF" />
                    </View>
                    <View>
                      <Text className="font-chivo-bold text-lg text-slate-900">
                        Ruas Jalan: {selectedArea.roadLengthMeters >= 1000 ? `${(selectedArea.roadLengthMeters / 1000).toFixed(1)} km` : `${selectedArea.roadLengthMeters} m`}
                      </Text>
                      <Text className="font-quicksand text-xs text-slate-500">
                        {selectedArea.clusterCount} titik kerusakan di sepanjang bentang jalan ini
                      </Text>
                    </View>
                  </View>
                  <Touchable
                    onPress={() => setIsAreaModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Tutup rincian ruas jalan"
                  >
                    <View className="rounded-full bg-slate-100 p-1.5">
                      <X size={18} color="#64748B" />
                    </View>
                  </Touchable>
                </View>

                {/* 3 Metrics Overview */}
                <View className="flex-row gap-2.5">
                  <View className="flex-1 rounded-2xl bg-slate-50 p-3 border border-slate-200/80">
                    <Text className="font-quicksand text-[11px] text-slate-500">
                      Total Klaster
                    </Text>
                    <Text className="font-chivo-bold text-xl text-slate-900 mt-0.5">
                      {selectedArea.clusterCount}
                    </Text>
                  </View>
                  <View className="flex-1 rounded-2xl bg-slate-50 p-3 border border-slate-200/80">
                    <Text className="font-quicksand text-[11px] text-slate-500">
                      Total Laporan
                    </Text>
                    <Text className="font-chivo-bold text-xl text-slate-900 mt-0.5">
                      {selectedArea.totalReports}
                    </Text>
                  </View>
                  <View className="flex-1 rounded-2xl bg-slate-50 p-3 border border-slate-200/80">
                    <Text className="font-quicksand text-[11px] text-slate-500">
                      Status Terparah
                    </Text>
                    <Text
                      className={`font-chivo-bold text-sm uppercase mt-1 ${
                        selectedArea.worstSeverity === "severe"
                          ? "text-red-700"
                          : selectedArea.worstSeverity === "high"
                          ? "text-rose-600"
                          : selectedArea.worstSeverity === "medium"
                          ? "text-amber-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {selectedArea.worstSeverity}
                    </Text>
                  </View>
                </View>

                {/* Breakdown Severity Distribution */}
                <View className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 gap-2">
                  <Text className="font-quicksand-bold text-xs text-slate-700">
                    Distribusi Tingkat Keparahan
                  </Text>
                  <View className="flex-row items-center justify-between gap-1.5">
                    <View className="flex-1 items-center rounded-xl bg-red-100/80 py-1.5 px-2">
                      <Text className="font-quicksand-bold text-[10px] text-red-800">
                        Severe
                      </Text>
                      <Text className="font-chivo-bold text-sm text-red-900">
                        {selectedArea.severityCounts.severe}
                      </Text>
                    </View>
                    <View className="flex-1 items-center rounded-xl bg-orange-100/80 py-1.5 px-2">
                      <Text className="font-quicksand-bold text-[10px] text-orange-800">
                        High
                      </Text>
                      <Text className="font-chivo-bold text-sm text-orange-900">
                        {selectedArea.severityCounts.high}
                      </Text>
                    </View>
                    <View className="flex-1 items-center rounded-xl bg-amber-100/80 py-1.5 px-2">
                      <Text className="font-quicksand-bold text-[10px] text-amber-800">
                        Medium
                      </Text>
                      <Text className="font-chivo-bold text-sm text-amber-900">
                        {selectedArea.severityCounts.medium}
                      </Text>
                    </View>
                    <View className="flex-1 items-center rounded-xl bg-yellow-100/80 py-1.5 px-2">
                      <Text className="font-quicksand-bold text-[10px] text-yellow-800">
                        Low
                      </Text>
                      <Text className="font-chivo-bold text-sm text-yellow-900">
                        {selectedArea.severityCounts.low}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* List of Clusters in Area */}
                <View className="gap-1.5">
                  <Text className="font-quicksand-bold text-xs text-slate-700">
                    Daftar Titik Klaster di Ruas Ini ({selectedArea.clusters.length})
                  </Text>
                  <ScrollView className="max-h-40" showsVerticalScrollIndicator={true}>
                    <View className="gap-1.5">
                      {selectedArea.clusters.map((pt, idx) => (
                        <Touchable
                          key={pt.id || idx}
                          onPress={() => {
                            const found = clusters.find((c) => c.id === pt.id);
                            if (found) {
                              setSelectedArea(null);
                              setSelectedCluster(found);
                              setIsClusterModalVisible(true);
                              onOpenClusterDetail?.(found);
                            }
                          }}
                        >
                          <View className="flex-row items-center justify-between rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm">
                            <View className="flex-row items-center gap-2">
                              <View
                                className={`h-2.5 w-2.5 rounded-full ${
                                  pt.severity === "severe"
                                    ? "bg-red-700"
                                    : pt.severity === "high"
                                    ? "bg-red-500"
                                    : pt.severity === "medium"
                                    ? "bg-amber-500"
                                    : "bg-yellow-400"
                                }`}
                              />
                              <Text className="font-mono text-[11px] text-slate-800">
                                {pt.position.latitude.toFixed(4)}, {pt.position.longitude.toFixed(4)}
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-1.5">
                              <Text className="font-quicksand text-[11px] text-slate-500">
                                {pt.reportCount} lap
                              </Text>
                              <Text
                                className={`font-quicksand-bold text-[10px] uppercase ${
                                  pt.severity === "severe"
                                    ? "text-red-700"
                                    : pt.severity === "high"
                                    ? "text-rose-600"
                                    : pt.severity === "medium"
                                    ? "text-amber-600"
                                    : "text-yellow-600"
                                }`}
                              >
                                {pt.severity}
                              </Text>
                            </View>
                          </View>
                        </Touchable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Primary Action Button: Zoom in to area */}
                <Touchable
                  onPress={() => {
                    const center = selectedArea.center;
                    setIsAreaModalVisible(false);
                    setFocusCoords({
                      latitude: center.latitude,
                      longitude: center.longitude,
                      zoom: 17.5,
                    });
                  }}
                  className="mt-1 flex-row items-center justify-center gap-2 rounded-2xl bg-custom-primary py-3.5 shadow-md active:opacity-90"
                >
                  <ZoomIn size={18} color="#ffffff" />
                  <Text className="font-quicksand-bold text-sm text-white">
                    Perbesar & Lihat Klaster di Peta
                  </Text>
                </Touchable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable onPress={onPress}>
      <View
        className={`rounded-full border px-2.5 py-1 shadow-sm ${
          active
            ? "border-custom-primary bg-custom-primary"
            : "border-slate-200/90 bg-white/95"
        }`}
      >
        <Text
          className={`font-quicksand-bold text-[10px] ${
            active ? "text-white" : "text-slate-600"
          }`}
        >
          {label}
        </Text>
      </View>
    </Touchable>
  );
}
