import { View } from "react-native";

import { HypergridMap } from "@/components/map/hypergrid-map";
import { HISTORY_MAP_DATA } from "@/components/map/map-data";

import { CAR_IMAGE } from "@/components/ride/mock-data";

/**
 * Route Map Preview — kartu peta ringkas di Riwayat Perjalanan.
 *
 * Sekarang memakai map native yang sama dengan Main Page, hanya gestur
 * pan/zoom dimatikan (`interactive={false}`) supaya peta tidak aberrant
 * mengambil alih scroll Screen.
 *
 * TODO(Tahap 2): ganti `HISTORY_MAP_DATA` dengan rute milik hari yang sedang
 * dipilih, dibaca dari API (lihat `components/history/mock-data.ts`).
 */
export function RouteMapPreview() {
  return (
    <View className="h-52 overflow-hidden rounded-2xl border border-[#CAD5E2]">
      <HypergridMap
        data={HISTORY_MAP_DATA}
        interactive={false}
        vehicleIcon={CAR_IMAGE}
      />
    </View>
  )
}
