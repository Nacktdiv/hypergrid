import { Navigation } from "lucide-react-native";
import React, { useMemo } from "react";
import { Text, View } from "react-native";

import { LeafletMap } from "@/components/map/leaflet-map";
import type { DamagePoint, LatLng, MapData } from "@/components/map/map-data";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";

export interface LiveMapProps {
  isPaused?: boolean;
  vehicleType?: "car" | "motor" | "bicycle";
  currentCoords?: LatLng | null;
  routeHistory?: LatLng[];
  plannedRoute?: LatLng[];
  liveDetections?: DamagePoint[];
  isLoadingHazards?: boolean;
  onDamagePress?: (point: DamagePoint) => void;
}

/**
 * Peta live full-screen untuk Drive Mode (Leaflet + OpenStreetMap).
 *
 * Menampilkan koordinat live perangkat, rute navigasi terarah (jika ada), jejak rute perjalanan nyata, serta
 * seluruh titik history dan klaster lubang jalan yang telah terekam di sekitar area jalan.
 */
export const LiveMap = React.memo(function LiveMap({
  isPaused = false,
  vehicleType = "car",
  currentCoords,
  routeHistory = [],
  plannedRoute,
  liveDetections = [],
  onDamagePress,
}: LiveMapProps) {
  const { colors, isDark } = useOptionalTheme();

  // Koordinat aktif pengguna (real-time atau titik terakhir jejak rute)
  const activeCoord: LatLng | null = useMemo(() => {
    if (currentCoords) return currentCoords;
    if (routeHistory.length > 0) return routeHistory[routeHistory.length - 1];
    return null;
  }, [currentCoords, routeHistory]);

  const fallbackRouteCoords = useMemo(
    () => (activeCoord ? [activeCoord] : []),
    [activeCoord]
  );

  // Rute prioritas: jika rute navigasi terarah aktif, pertahankan referensi plannedRoute.
  // Jika tidak, tampilkan jejak titik GPS perjalanan nyata yang sudah dilalui.
  const activeRouteCoordinates = useMemo(() => {
    if (plannedRoute && plannedRoute.length > 0) return plannedRoute;
    if (routeHistory.length > 0) return routeHistory;
    return fallbackRouteCoords;
  }, [plannedRoute, routeHistory, fallbackRouteCoords]);

  const routeObj = useMemo(
    () => ({
      id: "live-drive-route",
      coordinates: activeRouteCoordinates,
    }),
    [activeRouteCoordinates]
  );

  const mapData: MapData | null = useMemo(() => {
    if (!activeCoord) return null;

    return {
      camera: {
        latitude: activeCoord.latitude,
        longitude: activeCoord.longitude,
        zoom: 16.5,
      },
      route: routeObj,
      damagePoints: liveDetections,
      userLocation: activeCoord,
      vehiclePosition: activeCoord,
    };
  }, [activeCoord, routeObj, liveDetections]);

  // Tampilkan Skeleton saat GPS & data peta sedang dimuat
  if (!mapData || !activeCoord) {
    return (
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: colors.canvas }}
      >
        <View
          className="w-full max-w-xs items-center gap-3.5 rounded-3xl border px-6 py-6 shadow-sm"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <View
            className="rounded-full p-3"
            style={{ backgroundColor: colors.brandSoft }}
          >
            <Navigation size={26} color={colors.brand} />
          </View>
          <Skeleton dark={isDark} className="h-4 w-40 rounded-lg" />
          <Skeleton dark={isDark} className="h-3 w-52 rounded-md" />
          <View className="w-full flex-row gap-2 pt-2">
            <Skeleton dark={isDark} className="flex-1 h-8 rounded-xl" />
            <Skeleton dark={isDark} className="flex-1 h-8 rounded-xl" />
          </View>
          <Text
            className="mt-1 text-center font-inter text-xs"
            style={{ color: colors.textMuted }}
          >
            Preparing live telemetry map and hazard clusters...
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
