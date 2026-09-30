import { Image, type ImageSource } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
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
 * Memakai `react-native-maps` — library ini sudah termasuk di Expo Go, jadi
 * peta langsung bisa dicoba tanpa development build:
 *   npx expo start  →  pindai QR code dengan Expo Go
 *
 * CATATAN
 * 1. Penanda kerusakan digambar sebagai `Marker` berisi lingkaran 36px
 *    bespoke, bukan `Circle`. Alasannya: Figma memakai lingkaran fixed-size
 *    dengan angka di dalamnya, dan marker itulah yang bisa di-tap (Circle
 *    tidak punya callback tap di versi ini). Ukurannya juga tetap konstan
 *    saat zoom, sama seperti desain.
 * 2. Di Expo Go, Android memakai peta bawaan Google Maps. Saat rilis ke app
 *    store, API key + config plugin perlu disiapkan (lihat README).
 * 3. Seluruh isi peta berasal dari prop `data` (`MapData`), sehingga saat data
 *    API sudah tersedia cukup ganti sumber datanya — komponen ini tidak perlu
 *    diubah. TODO(Tahap 2): sumber data peta pindah ke API.
 */

/** Ukuran ikon kendaraan di peta, dalam px logis. */
const VEHICLE_ICON_SIZE = 44

export type HypergridMapProps = {
  data: MapData
  /** Ikon kendaraan aktif (hasil `require(...)`). */
  vehicleIcon: ImageSource
  /** Matikan gestur pan/zoom — untuk peta thumbnail di dalam ScrollView. */
  interactive?: boolean
}

export function HypergridMap({
  data,
  vehicleIcon,
  interactive = true,
}: HypergridMapProps) {
  return (
    <MapView
      initialRegion={toRegion(data.camera)}
      pitchEnabled={false}
      provider={PROVIDER_GOOGLE}
      rotateEnabled={interactive}
      scrollEnabled={interactive}
      showsCompass={false}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      showsUserLocation={false}
      style={StyleSheet.absoluteFill}
      toolbarEnabled={false}
      zoomEnabled={interactive}
    >
      {/* Jalur rute — Figma #114:1272 */}
      <Polyline
        coordinates={data.route.coordinates}
        geodesic
        strokeColor={ROUTE_COLOR}
        strokeWidth={5}
      />

      {data.damagePoints.map((point) => (
        <DamageMarker key={point.id} point={point} />
      ))}

      {/* Kendaraan aktif — mengikuti pilihan di VehicleSelector */}
      <Marker anchor={{ x: 0.5, y: 0.5 }} coordinate={data.vehiclePosition} title="Kendaraan aktif">
        <Image
          contentFit="contain"
          source={vehicleIcon}
          style={{ height: VEHICLE_ICON_SIZE, width: VEHICLE_ICON_SIZE }}
        />
      </Marker>

      {/* Titik user — Figma `You` #I114:1274;2:723 */}
      <Marker anchor={{ x: 0.5, y: 0.5 }} coordinate={data.userLocation} tracksViewChanges={false}>
        <View
          style={[
            styles.userDot,
            { backgroundColor: USER_COLOR },
          ]}
        />
      </Marker>
    </MapView>
  )
}

/**
 * Lingkaran kerusakan 36px dengan jumlah laporan — Figma `Red` #155:148,
 * `Yellow 1` #114:1278, `Yellow 2` #155:152.
 */
function DamageMarker({ point }: { point: DamagePoint }) {
  const isLow = point.severity === "low"

  return (
    <Marker
      anchor={{ x: 0.5, y: 0.5 }}
      coordinate={point.position}
      onPress={() => onDamagePress(point)}
      tracksViewChanges={false}
    >
      <View style={[styles.damageDot, { backgroundColor: SEVERITY_COLOR[point.severity] }]}>
        <Text style={[styles.damageCount, { color: isLow ? "#121212" : "#FFFFFF" }]}>
          {point.reportCount}
        </Text>
      </View>

      <Callout tooltip>
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>{point.reportCount} laporan kerusakan</Text>
          <Text style={styles.calloutBody}>Severity: {point.severity}</Text>
        </View>
      </Callout>
    </Marker>
  )
}

/** `react-native-maps` memakai delta (derajat), bukan zoom level. */
function toRegion(center: LatLng & { zoom: number }) {
  // Perbandingan kasar: zoom 14 ≈ 0.02° delta, zoom 15.5 ≈ 0.007°.
  const delta = 2 ** -center.zoom * 400

  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  }
}

/**
 * Tap pada penanda kerusakan.
 * TODO(Tahap 2): ganti dengan navigasi ke halaman detail laporan.
 */
function onDamagePress(point: DamagePoint) {
  // Callout sudah menampilkan detail, jadi cukup log ke console dulu.
  // TODO(Tahap 2): arahkan ke halaman detail dari API.
  console.log(
    `[HyperGrid] marker ${point.id} ditekan — ${point.reportCount} laporan, severity ${point.severity}`
  )
}

const styles = StyleSheet.create({
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
})
