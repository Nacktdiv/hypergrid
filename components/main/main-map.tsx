import { View } from "react-native";

import { HypergridMap } from "@/components/map/hypergrid-map";
import { MAIN_MAP_DATA } from "@/components/map/map-data";

import { VEHICLE_IMAGES, type VehicleId } from "./mock-data";

/**
 * Peta utama — Figma `Map` #114:1270.
 *
 * Sekarang memakai map native (Apple Maps / Google Maps) lewat
 * `components/map/hypergrid-map.tsx`. Gaya yang dipertahankan:
 *   - radius 16, border 1px #CAD5E2
 *   - jalur rute #2985FF, 5px, putus-putus
 *   - lingkaran kerusakan per severity + titik user #1A73E8
 *
 * Ikon kendaraan di peta mengikuti pilihan pengguna di VehicleSelector.
 * TODO(Tahap 2): data peta (rute, titik kerusakan) dibaca dari API.
 */
export function MainMap({ vehicleId }: { vehicleId: VehicleId }) {
  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-[#CAD5E2]">
      <HypergridMap data={MAIN_MAP_DATA} vehicleIcon={VEHICLE_IMAGES[vehicleId]} />
    </View>
  )
}
