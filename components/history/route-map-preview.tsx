import React, { useMemo } from "react";
import { View } from "react-native";

import { LeafletMap } from "@/components/map/leaflet-map";
import type { DamagePoint, LatLng, MapData } from "@/components/map/map-data";
import { useOptionalTheme } from "@/contexts/theme-context";

export interface RouteMapPreviewProps {
  routeCoordinates?: LatLng[];
  damagePoints?: DamagePoint[];
}

/**
 * Route Map Preview — compact route map for trip history.
 */
export const RouteMapPreview = React.memo(function RouteMapPreview({
  routeCoordinates = [],
  damagePoints = [],
}: RouteMapPreviewProps) {
  const { colors } = useOptionalTheme();

  const mapData: MapData = useMemo(() => {
    const centerPoint: LatLng =
      routeCoordinates.length > 0
        ? routeCoordinates[0]
        : damagePoints.length > 0
          ? damagePoints[0].position
          : { latitude: -6.2088, longitude: 106.8456 };

    return {
      camera: {
        latitude: centerPoint.latitude,
        longitude: centerPoint.longitude,
        zoom: 14,
      },
      route: {
        id: "history-route",
        coordinates: routeCoordinates,
      },
      damagePoints,
      userLocation: centerPoint,
      vehiclePosition: centerPoint,
    };
  }, [routeCoordinates, damagePoints]);

  return (
    <View
      className="h-56 overflow-hidden rounded-3xl border shadow-sm"
      style={{
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <LeafletMap data={mapData} interactive={true} />
    </View>
  );
});
