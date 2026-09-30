import { Image, type ImageSource } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  ROUTE_COLOR,
  SEVERITY_COLOR,
  USER_COLOR,
  projectToPercent,
  type LatLng,
  type MapData,
} from "./map-data";

/**
 * Fallback peta untuk platform web.
 *
 * `react-native-maps` tidak berjalan di browser, jadi saat preview di
 * `npx expo start --web` peta digambar memakai gambar statis Figma.
 * Data yang digambar tetap berasal dari `MapData` yang sama dengan map
 * device — hanya posisinya diproyeksikan linier ke dalam area gambar.
 *
 * Di device (iOS/Android) komponen ini tidak pernah dipakai.
 */
export function StaticMapFallback({
  data,
  vehicleIcon,
}: {
  data: MapData
  vehicleIcon: ImageSource
}) {
  return (
    <View className="flex-1 overflow-hidden">
      <Image
        source={require("@/assets/history/map-base.png")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />

      <RoutePath coordinates={data.route.coordinates} />

      {data.damagePoints.map((point) => (
        <View
          key={point.id}
          className="absolute h-9 w-9 items-center justify-center rounded-full"
          style={{
            backgroundColor: SEVERITY_COLOR[point.severity],
            left: projectToPercent(point.position).left,
            marginLeft: -18,
            marginTop: -18,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            top: projectToPercent(point.position).top,
          }}
        >
          <Text
            className="font-mono-bold text-base"
            style={{ color: point.severity === "low" ? "#121212" : "#FFFFFF" }}
          >
            {point.reportCount}
          </Text>
        </View>
      ))}

      {/* Ikon kendaraan aktif — mengikuti pilihan di VehicleSelector */}
      <Image
        contentFit="contain"
        source={vehicleIcon}
        style={{
          height: 36,
          left: projectToPercent(data.vehiclePosition).left,
          marginLeft: -18,
          marginTop: -18,
          position: "absolute",
          top: projectToPercent(data.vehiclePosition).top,
          width: 36,
        }}
        transition={200}
      />

      {/* Titik user — Figma `You` #I114:1274;2:723 */}
      <View
        className="absolute h-6 w-6 items-center justify-center rounded-full border-[3px] border-white"
        style={{
          backgroundColor: USER_COLOR,
          left: projectToPercent(data.userLocation).left,
          marginLeft: -12,
          marginTop: -12,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          top: projectToPercent(data.userLocation).top,
        }}
      />
    </View>
  )
}

/** Jalur rute putus-putus, digambar lewat proyeksi yang sama. */
function RoutePath({ coordinates }: { coordinates: LatLng[] }) {
  const path = coordinates
    .map((point, index) => {
      const { left, top } = projectToPercent(point)
      // Buang tanda `%` — viewBox SVG di bawah memakai skala 0-100.
      const x = Number.parseFloat(left)
      const y = Number.parseFloat(top)

      return `${index === 0 ? "M" : "L"} ${x} ${y}`
    })
    .join(" ")

  return (
    <Svg
      height="100%"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      width="100%"
    >
      <Path
        d={path}
        fill="none"
        stroke={ROUTE_COLOR}
        strokeDasharray="0.6 8"
        strokeLinecap="round"
        strokeWidth={5}
        vectorEffect="non-scaling-stroke"
      />
    </Svg>
  )
}
