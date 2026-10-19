import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  View,
} from "react-native";
import {
  Database,
  MapPin,
  ShieldAlert,
  X,
} from "lucide-react-native";

import { LeafletMap } from "@/components/map/leaflet-map";
import {
  type DamagePoint,
  type MapData,
} from "@/components/map/map-data";
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
 *   - Live GPS Device tracking koordinat lokasi pengguna saat ini
 *   - Ikon lokasi marker dinamis (Mobil / Motor / Sepeda)
 *   - Menampilkan seluruh klaster PostGIS publik dari database (bukan hanya history user)
 *   - Filter chip status klaster (Semua, Aktif, Terverifikasi, Selesai)
 *   - Modal detail informasi klaster (read-only untuk pengguna mobile)
 */
export type MainMapProps = {
  vehicleId: VehicleId;
  fullBleed?: boolean;
  showOverlayControls?: boolean;
  onOpenClusterDetail?: (cluster: PotholeCluster) => void;
};

export function MainMap({
  vehicleId,
  fullBleed = false,
  showOverlayControls = true,
  onOpenClusterDetail,
}: MainMapProps) {
  const { clusters, fetchClusters } = usePotholeClusters();
  const {
    coords: liveCoords,
    getImmediateLocation,
    errorMsg,
  } = useUserLocation();

  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [selectedCluster, setSelectedCluster] = useState<PotholeCluster | null>(
    null
  );

  // Ambil seluruh klaster lubang jalan nyata di database secara publik (seluruh titik kota)
  useEffect(() => {
    fetchClusters({ limit: 500 });
  }, [fetchClusters]);

  // Filter klaster berdasarkan tab yang dipilih
  const filteredClusters = useMemo(() => {
    if (activeFilter === "all") return clusters;
    return clusters.filter((c) => c.status === activeFilter);
  }, [clusters, activeFilter]);

  const mapData: MapData = useMemo(() => {
    const baseCenter = liveCoords || { latitude: -6.2088, longitude: 106.8456 };

    // Hanya render data riil dari PostGIS clusters (tanpa titik dummy)
    const liveDamagePoints: DamagePoint[] = filteredClusters.map((c) => ({
      id: c.id,
      position: {
        latitude: c.center_latitude,
        longitude: c.center_longitude,
      },
      severity: c.severity === "severe" ? "high" : c.severity,
      reportCount: c.detection_count,
    }));

    return {
      camera: {
        latitude: baseCenter.latitude,
        longitude: baseCenter.longitude,
        zoom: 15,
      },
      route: { id: "user-route", coordinates: [] },
      damagePoints: liveDamagePoints,
      userLocation: baseCenter,
      vehiclePosition: baseCenter,
    };
  }, [filteredClusters, liveCoords]);

  const handleMarkerPress = (point: DamagePoint) => {
    const found = clusters.find((c) => c.id === point.id);
    if (found) {
      setSelectedCluster(found);
    }
  };

  if (!liveCoords) {
    return (
      <View
        className={
          fullBleed
            ? "flex-1 w-full h-full items-center justify-center bg-[#0B0F19] p-4"
            : "flex-1 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[#0B0F19] p-4"
        }
        style={fullBleed ? { width: "100%", height: "100%" } : { height: 340, width: "100%" }}
      >
        {errorMsg ? (
          <View className="items-center gap-2">
            <ShieldAlert size={28} color="#F59E0B" />
            <Text className="text-center font-quicksand-bold text-xs text-white">
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
          <View className="items-center gap-2">
            <ActivityIndicator size="small" color="#009EFF" />
            <Text className="mt-2 font-quicksand-bold text-xs text-white">
              Menghubungkan GPS...
            </Text>
            <Text className="text-center font-quicksand text-[11px] text-slate-400">
              Mengunci posisi satelit perangkat Anda
            </Text>
          </View>
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
        onDamagePress={handleMarkerPress}
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
                  ? `PostGIS: ${filteredClusters.length} Clusters`
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
        visible={Boolean(selectedCluster)}
        onRequestClose={() => setSelectedCluster(null)}
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
                    onPress={() => setSelectedCluster(null)}
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
