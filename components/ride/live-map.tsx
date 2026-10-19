import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { Navigation } from "lucide-react-native";

import { cn } from "@/lib/utils";
import { LeafletMap } from "@/components/map/leaflet-map";
import type { DamagePoint, LatLng, MapData } from "@/components/map/map-data";
import { Skeleton } from "@/components/ui/skeleton";

export interface LiveMapProps {
  isPaused?: boolean;
  vehicleType?: "car" | "motor" | "bicycle";
  currentCoords?: LatLng | null;
  routeHistory?: LatLng[];
  liveDetections?: DamagePoint[];
  isLoadingHazards?: boolean;
  onDamagePress?: (point: DamagePoint) => void;
}

/**
 * Peta live full-screen untuk Drive Mode (Leaflet + OpenStreetMap).
 *
 * Menampilkan koordinat live perangkat, jejak rute perjalanan nyata, serta
 * seluruh titik history dan klaster lubang jalan yang telah terekam di sekitar area jalan.
 */
export const LiveMap = React.memo(function LiveMap({
  isPaused = false,
  vehicleType = "car",
  currentCoords,
  routeHistory = [],
  liveDetections = [],
  onDamagePress,
}: LiveMapProps) {
  // Koordinat aktif pengguna (real-time atau titik terakhir jejak rute)
  const activeCoord: LatLng | null = useMemo(() => {
    if (currentCoords) return currentCoords;
    if (routeHistory.length > 0) return routeHistory[routeHistory.length - 1];
    return null;
  }, [currentCoords, routeHistory]);

  const mapData: MapData | null = useMemo(() => {
    if (!activeCoord) return null;

    return {
      camera: {
        latitude: activeCoord.latitude,
        longitude: activeCoord.longitude,
        zoom: 16.5,
      },
      route: {
        id: "live-drive-route",
        coordinates: routeHistory.length > 0 ? routeHistory : [activeCoord],
      },
      damagePoints: liveDetections,
      userLocation: activeCoord,
      vehiclePosition: activeCoord,
    };
  }, [activeCoord, routeHistory, liveDetections]);

  // Tampilkan Skeleton saat GPS & data peta sedang dimuat
  if (!mapData || !activeCoord) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0B0F19] px-6">
        <View className="w-full max-w-xs items-center gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/90 px-6 py-6 shadow-2xl">
          <View className="rounded-full bg-sky-500/10 p-3">
            <Navigation size={26} color="#009EFF" />
          </View>
          <Skeleton dark className="h-4 w-40 rounded-lg" />
          <Skeleton dark className="h-3 w-52 rounded-md" />
          <View className="w-full flex-row gap-2 pt-2">
            <Skeleton dark className="flex-1 h-8 rounded-xl" />
            <Skeleton dark className="flex-1 h-8 rounded-xl" />
          </View>
          <Text className="mt-1 text-center font-quicksand text-[11px] text-slate-400">
            Menyiapkan peta & memuat titik klaster jalan...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className={cn("flex-1", isPaused && "opacity-60")}>
      <LeafletMap
        data={mapData}
        vehicleType={vehicleType}
        interactive={!isPaused}
        onDamagePress={onDamagePress}
      />
    </View>
  );
});
