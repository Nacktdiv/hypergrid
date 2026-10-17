import React, { useMemo } from "react";
import { View } from "react-native";

import { cn } from "@/lib/utils";
import { LeafletMap } from "@/components/map/leaflet-map";
import {
  RIDE_MAP_DATA,
  type DamagePoint,
  type LatLng,
  type MapData,
} from "@/components/map/map-data";

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
 */
export function LiveMap({
  isPaused = false,
  vehicleType = "car",
  currentCoords,
  routeHistory = [],
  liveDetections = [],
}: LiveMapProps) {
  const mapData: MapData = useMemo(() => {
    const centerPoint: LatLng = currentCoords || RIDE_MAP_DATA.camera;
    const finalRoute =
      routeHistory.length > 0 ? routeHistory : [centerPoint];

    return {
      camera: {
        latitude: centerPoint.latitude,
        longitude: centerPoint.longitude,
        zoom: 16,
      },
      route: {
        id: "live-drive-route",
        coordinates: finalRoute,
      },
      damagePoints:
        liveDetections.length > 0
          ? liveDetections
          : RIDE_MAP_DATA.damagePoints,
      userLocation: centerPoint,
      vehiclePosition: centerPoint,
    };
  }, [currentCoords, routeHistory, liveDetections]);

  return (
    <View className={cn("flex-1", isPaused && "opacity-60")}>
      <LeafletMap data={mapData} vehicleType={vehicleType} interactive={!isPaused} />
    </View>
  );
}
