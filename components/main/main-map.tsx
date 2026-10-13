import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  View,
} from "react-native";
import {
  CheckCircle,
  Database,
  Layers,
  MapPin,
  ShieldAlert,
  Wrench,
  X,
} from "lucide-react-native";

import { LeafletMap } from "@/components/map/leaflet-map";
import { StaticMapFallback } from "@/components/map/static-map-fallback";
import {
  MAIN_MAP_DATA,
  type DamagePoint,
  type MapData,
} from "@/components/map/map-data";
import { Touchable } from "@/components/ui/touchable";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";
import { useUserLocation } from "@/hooks/use-user-location";
import type { PotholeCluster, PotholeStatus } from "@/types/api";

import { VEHICLE_IMAGES, type VehicleId } from "./mock-data";

type FilterStatus = "all" | PotholeStatus;

/**
 * Peta utama interaktif — Figma `Map` #114:1270.
 *
 * Dilengkapi:
 *   - Live GPS Device tracking koordinat lokasi pengguna saat ini
 *   - Query spasial klaster PostGIS real-time di sekitar koordinat perangkat
 *   - Filter chip status klaster (Semua, Aktif, Terverifikasi, Selesai)
 *   - Modal detail interaktif saat marker kerusakan ditekan
 *   - Aksi pembaruan status verifikasi PU langsung dari peta
 */
export function MainMap({ vehicleId }: { vehicleId: VehicleId }) {
  const { clusters, fetchClusters, updateStatus } = usePotholeClusters();
  const { coords: liveCoords, getImmediateLocation } = useUserLocation();

  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [selectedCluster, setSelectedCluster] = useState<PotholeCluster | null>(
    null
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [useVectorMap, setUseVectorMap] = useState(false);

  // Ambil klaster di sekitar live koordinat pengguna saat ini jika tersedia
  useEffect(() => {
    if (liveCoords) {
      fetchClusters({
        minLat: liveCoords.latitude - 0.08,
        minLon: liveCoords.longitude - 0.08,
        maxLat: liveCoords.latitude + 0.08,
        maxLon: liveCoords.longitude + 0.08,
        limit: 100,
      });
    } else {
      fetchClusters({ limit: 100 });
    }
  }, [fetchClusters, liveCoords]);

  // Filter klaster berdasarkan tab yang dipilih
  const filteredClusters = useMemo(() => {
    if (activeFilter === "all") return clusters;
    return clusters.filter((c) => c.status === activeFilter);
  }, [clusters, activeFilter]);

  const mapData: MapData = useMemo(() => {
    const baseCenter = liveCoords || MAIN_MAP_DATA.camera;

    const liveDamagePoints: DamagePoint[] =
      filteredClusters.length > 0
        ? filteredClusters.map((c) => ({
            id: c.id,
            position: {
              latitude: c.center_latitude,
              longitude: c.center_longitude,
            },
            severity: c.severity === "severe" ? "high" : c.severity,
            reportCount: c.detection_count,
          }))
        : MAIN_MAP_DATA.damagePoints;

    return {
      camera: {
        latitude: baseCenter.latitude,
        longitude: baseCenter.longitude,
        zoom: liveCoords ? 15 : MAIN_MAP_DATA.camera.zoom,
      },
      route: MAIN_MAP_DATA.route,
      damagePoints: liveDamagePoints,
      userLocation: baseCenter,
      vehiclePosition: baseCenter,
    };
  }, [filteredClusters, liveCoords]);

  const handleMarkerPress = (point: DamagePoint) => {
    const found = clusters.find((c) => c.id === point.id);
    if (found) {
      setSelectedCluster(found);
    } else {
      // Mock cluster jika menekan titik default koridor
      setSelectedCluster({
        id: point.id,
        center_latitude: point.position.latitude,
        center_longitude: point.position.longitude,
        severity: point.severity,
        confidence_avg: 0.94,
        detection_count: point.reportCount,
        status: "active",
        first_detected_at: new Date().toISOString(),
        last_detected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  };

  const handleUpdateStatus = async (newStatus: PotholeStatus) => {
    if (!selectedCluster) return;
    setIsUpdatingStatus(true);
    try {
      await updateStatus(selectedCluster.id, { status: newStatus });
      setSelectedCluster((prev) => (prev ? { ...prev, status: newStatus } : null));
      Alert.alert(
        "Status Updated",
        `Road cluster successfully marked as: ${newStatus.toUpperCase()}`
      );
    } catch (err: any) {
      Alert.alert(
        "Update Failed",
        err.message || "Ensure server connection is available."
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <View
      className="flex-1 w-full overflow-hidden rounded-2xl border border-[#CAD5E2]"
      style={{ height: 340, width: "100%" }}
    >
      {useVectorMap ? (
        <StaticMapFallback
          data={mapData}
          onDamagePress={handleMarkerPress}
          vehicleIcon={VEHICLE_IMAGES[vehicleId]}
        />
      ) : (
        <LeafletMap
          data={mapData}
          onDamagePress={handleMarkerPress}
        />
      )}

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

      {/* FLOATING STATUS BADGE POSTGIS & FILTER CHIPS */}
      <View className="absolute inset-x-3 top-3 gap-2">
        <View className="flex-row items-center justify-between">
          {/* Status Badge */}
          <View className="self-start flex-row items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-2.5 py-1 shadow-sm backdrop-blur-md">
            <Database size={12} color="#009EFF" />
            <Text className="font-mono text-[10px] text-slate-700">
              {clusters.length > 0
                ? `PostGIS: ${filteredClusters.length} Clusters`
                : "Active Map Corridor"}
            </Text>
          </View>

          {/* Toggle Map Mode */}
          <Touchable onPress={() => setUseVectorMap((prev) => !prev)}>
            <View className="flex-row items-center gap-1.5 rounded-full border border-sky-300 bg-white/95 px-2.5 py-1 shadow-sm backdrop-blur-md">
              <Layers size={11} color="#009EFF" />
              <Text className="font-mono-bold text-[10px] text-sky-700">
                {useVectorMap ? "🗺️ Visual Map" : "🌍 OpenStreetMap"}
              </Text>
            </View>
          </Touchable>
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

      {/* ROAD DAMAGE CLUSTER DETAIL MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(selectedCluster)}
        onRequestClose={() => setSelectedCluster(null)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-[32px] bg-white p-6 shadow-2xl">
            {selectedCluster ? (
              <View className="gap-4">
                {/* Header */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <ShieldAlert size={22} color="#EF4444" />
                    <Text className="font-chivo-bold text-lg text-slate-900">
                      Road Damage Details
                    </Text>
                  </View>
                  <Touchable onPress={() => setSelectedCluster(null)}>
                    <View className="rounded-full bg-slate-100 p-1.5">
                      <X size={18} color="#64748B" />
                    </View>
                  </Touchable>
                </View>

                {/* Info Card Grid */}
                <View className="rounded-2xl border border-slate-200 bg-slate-50 p-4 gap-3">
                  <View className="flex-row items-center justify-between border-b border-slate-200/60 pb-2">
                    <View className="flex-row items-center gap-1.5">
                      <MapPin size={14} color="#64748B" />
                      <Text className="font-quicksand-semibold text-xs text-slate-500">
                        PostGIS Coordinates
                      </Text>
                    </View>
                    <Text className="font-mono text-xs text-slate-800">
                      {selectedCluster.center_latitude.toFixed(4)},{" "}
                      {selectedCluster.center_longitude.toFixed(4)}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between border-b border-slate-200/60 pb-2">
                    <Text className="font-quicksand-semibold text-xs text-slate-500">
                      Severity Level
                    </Text>
                    <View
                      className={`rounded-full px-2.5 py-0.5 ${
                        selectedCluster.severity === "high" ||
                        selectedCluster.severity === "severe"
                          ? "bg-rose-100"
                          : selectedCluster.severity === "medium"
                          ? "bg-amber-100"
                          : "bg-yellow-100"
                      }`}
                    >
                      <Text
                        className={`font-mono-bold text-[11px] ${
                          selectedCluster.severity === "high" ||
                          selectedCluster.severity === "severe"
                            ? "text-rose-700"
                            : selectedCluster.severity === "medium"
                            ? "text-amber-700"
                            : "text-yellow-800"
                        }`}
                      >
                        {selectedCluster.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between border-b border-slate-200/60 pb-2">
                    <Text className="font-quicksand-semibold text-xs text-slate-500">
                      Reports / Detections
                    </Text>
                    <Text className="font-mono-bold text-xs text-slate-800">
                      {selectedCluster.detection_count} Reports
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between border-b border-slate-200/60 pb-2">
                    <Text className="font-quicksand-semibold text-xs text-slate-500">
                      Average AI Confidence
                    </Text>
                    <Text className="font-mono-bold text-xs text-emerald-600">
                      {Math.round(selectedCluster.confidence_avg * 100)}%
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="font-quicksand-semibold text-xs text-slate-500">
                      Remediation Status
                    </Text>
                    <Text className="font-mono-bold text-xs text-sky-600">
                      {selectedCluster.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Field Officer Verification Actions */}
                <View className="gap-2 pt-1">
                  <Text className="font-quicksand-semibold text-xs text-slate-500">
                    Field Verification Actions:
                  </Text>
                  <View className="flex-row gap-2">
                    <Touchable
                      className="flex-1"
                      onPress={() => handleUpdateStatus("verified")}
                    >
                      <View className="flex-row items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 shadow-sm">
                        {isUpdatingStatus ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <CheckCircle size={16} color="#FFFFFF" />
                            <Text className="font-quicksand-bold text-xs text-white">
                              Validate (Verified)
                            </Text>
                          </>
                        )}
                      </View>
                    </Touchable>

                    <Touchable
                      className="flex-1"
                      onPress={() => handleUpdateStatus("repaired")}
                    >
                      <View className="flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 shadow-sm">
                        <Wrench size={16} color="#FFFFFF" />
                        <Text className="font-quicksand-bold text-xs text-white">
                          Mark Repaired
                        </Text>
                      </View>
                    </Touchable>
                  </View>
                </View>
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
