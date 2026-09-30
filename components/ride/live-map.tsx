import { View } from "react-native";

import { cn } from "@/lib/utils";
import { HypergridMap } from "@/components/map/hypergrid-map";
import { RIDE_MAP_DATA } from "@/components/map/map-data";

import { CAR_IMAGE } from "./mock-data";

/**
 * Peta live full-screen untuk Drive Mode.
 *
 * Memakai map native yang sama dengan Main Page, hanya kamera dibuat lebih
 * dekat (zoom 15.5) mengikuti desain `start driving` #114:1384.
 *
 * Gestur pan/zoom tetap aktif karena pengguna sedang menelusuri rute.
 * Saat dijeda, peta diredupkan (opacity 60%).
 * TODO(Tahap 2): data peta (rute, titik kerusakan) dibaca dari API.
 */
export function LiveMap({ isPaused = false }: { isPaused?: boolean }) {
  return (
    <View className={cn("flex-1", isPaused && "opacity-60")}>
      <HypergridMap data={RIDE_MAP_DATA} vehicleIcon={CAR_IMAGE} />
    </View>
  )
}
