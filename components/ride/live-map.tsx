import React, { useMemo } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Navigation } from "lucide-react-native";

import { cn } from "@/lib/utils";
import { LeafletMap } from "@/components/map/leaflet-map";
import type { DamagePoint, LatLng, MapData } from "@/components/map/map-data";

export interface LiveMapProps {
  isPaused?: boolean;
  vehicleType?: "car" | "motor" | "bicycle";
  currentCoords?: LatLng | null;
  routeHistory?: LatLng[];
  liveDetections?: DamagePoint[];
}

/**
 * Peta live full-screen untuk Drive Mode (Leaflet + OpenStreetMap).
 *
 * Menerima koordinat live perangkat dan jejak rute perjalanan nyata pengguna.
 * Tidak pernah menggunakan fallback Jakarta (mencegah lompatan peta dari 'lokasi anta berantah').
 */
export const LiveMap = React.memo(function LiveMap({
  isPaused = false,
  vehicleType = "car",
  currentCoords,
  routeHistory = [],
  liveDetections = [],
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

  // Jika GPS belum mendapatkan sinyal sama sekali, tampilkan status pencarian satelit
  // dan jangan pernah me-render koordinat Jakarta secara tiba-tiba.
  if (!mapData || !activeCoord) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0B0F19]">
        <View className="items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 px-6 py-5 shadow-2xl">
          <View className="rounded-full bg-sky-500/10 p-3">
            <Navigation size={28} color="#009EFF" />
          </View>
          <ActivityIndicator size="small" color="#009EFF" />
          <Text className="font-quicksand-bold text-sm text-white">
            Menghubungkan GPS...
          </Text>
          <Text className="text-center font-quicksand text-xs text-slate-400">
            Mengunci posisi satelit perangkat Anda
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
      />
    </View>
  );
});
