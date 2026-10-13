import { Image, type ImageSource } from "expo-image";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import {
  ROUTE_COLOR,
  SEVERITY_COLOR,
  USER_COLOR,
  type DamagePoint,
  type LatLng,
  type MapData,
} from "./map-data";

/**
 * Peta HyperGrid.
 *
 * Memakai `react-native-maps` — library ini sudah termasuk di Expo Go.
 * Mendukung penanda klaster interaktif, rute polyline, lokasi pengguna, dan callback tap kerusakan.
 */

/** Ukuran ikon kendaraan di peta, dalam px logis. */
const VEHICLE_ICON_SIZE = 44;

export type HypergridMapProps = {
  data: MapData;
  /** Ikon kendaraan aktif (hasil `require(...)`). */
  vehicleIcon: ImageSource;
  /** Matikan gestur pan/zoom — untuk peta thumbnail di dalam ScrollView. */
  interactive?: boolean;
  /** Callback saat titik kerusakan jalan ditekan */
  onDamagePress?: (point: DamagePoint) => void;
};

export function HypergridMap({
  data,
  vehicleIcon,
  interactive = true,
  onDamagePress,
}: HypergridMapProps) {
  // Pada iOS default menggunakan Apple Maps (undefined). Pada Android menggunakan Google Maps.
  const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;
  const currentRegion = toRegion(data.camera);

  return (
    <View style={styles.container}>
      <MapView
        initialRegion={currentRegion}
        key={`map-${data.camera.latitude}-${data.camera.longitude}`}
        loadingBackgroundColor="#F8FAFC"
        loadingEnabled={true}
        loadingIndicatorColor="#009EFF"
        onMapReady={() => {
          console.log("[HypergridMap] Native map successfully mounted and ready");
        }}
        pitchEnabled={false}
        provider={mapProvider}
        rotateEnabled={interactive}
        scrollEnabled={interactive}
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        showsUserLocation={false}
        style={styles.map}
        toolbarEnabled={false}
        zoomEnabled={interactive}
      >
        {/* Jalur rute — Figma #114:1272 */}
        {data.route.coordinates.length > 0 ? (
          <Polyline
            coordinates={data.route.coordinates}
            geodesic
            strokeColor={ROUTE_COLOR}
            strokeWidth={5}
          />
        ) : null}

        {data.damagePoints.map((point) => (
          <DamageMarker
            key={point.id}
            point={point}
            onPress={onDamagePress}
          />
        ))}

        {/* Kendaraan aktif — mengikuti pilihan di VehicleSelector */}
        <Marker
          anchor={{ x: 0.5, y: 0.5 }}
          coordinate={data.vehiclePosition}
          title="Kendaraan aktif"
        >
          <Image
            contentFit="contain"
            source={vehicleIcon}
            style={{ height: VEHICLE_ICON_SIZE, width: VEHICLE_ICON_SIZE }}
          />
        </Marker>

        {/* Titik user — Figma `You` #I114:1274;2:723 */}
        <Marker
          anchor={{ x: 0.5, y: 0.5 }}
          coordinate={data.userLocation}
          tracksViewChanges={false}
        >
          <View style={[styles.userDot, { backgroundColor: USER_COLOR }]} />
        </Marker>
      </MapView>
    </View>
  );
}

/**
 * Lingkaran kerusakan 36px dengan jumlah laporan — Figma `Red` #155:148,
 * `Yellow 1` #114:1278, `Yellow 2` #155:152.
 */
function DamageMarker({
  point,
  onPress,
}: {
  point: DamagePoint;
  onPress?: (point: DamagePoint) => void;
}) {
  const isLow = point.severity === "low";

  return (
    <Marker
      anchor={{ x: 0.5, y: 0.5 }}
      coordinate={point.position}
      onPress={() => {
        if (onPress) {
          onPress(point);
        } else {
          console.log(
            `[HyperGrid] marker ${point.id} ditekan — ${point.reportCount} laporan, severity ${point.severity}`
          );
        }
      }}
      tracksViewChanges={false}
    >
      <View
        style={[
          styles.damageDot,
          { backgroundColor: SEVERITY_COLOR[point.severity] },
        ]}
      >
        <Text
          style={[
            styles.damageCount,
            { color: isLow ? "#121212" : "#FFFFFF" },
          ]}
        >
          {point.reportCount}
        </Text>
      </View>

      <Callout tooltip>
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>
            {point.reportCount} laporan kerusakan
          </Text>
          <Text style={styles.calloutBody}>Keparahan: {point.severity}</Text>
        </View>
      </Callout>
    </Marker>
  );
}

/** `react-native-maps` memakai delta (derajat), bukan zoom level. */
function toRegion(center: LatLng & { zoom: number }) {
  const delta = 2 ** -center.zoom * 400;

  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: "100%",
    position: "relative",
    width: "100%",
  },
  map: {
    ...StyleSheet.absoluteFill,
    height: "100%",
    width: "100%",
  },
  damageDot: {
    alignItems: "center",
    borderRadius: 20,
    height: 36,
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: 36,
  },
  damageCount: {
    fontSize: 16,
  },
  userDot: {
    borderColor: "#FFFFFF",
    borderRadius: 11,
    borderWidth: 4,
    height: 22,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: 22,
  },
  callout: {
    gap: 2,
    paddingHorizontal: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  calloutBody: {
    fontSize: 12,
  },
});
