import { Image } from "expo-image";
import { Text, View } from "react-native";

import { useVehicle } from "@/contexts/vehicle-context";

/**
 * Selected Vehicle Card — kartu kendaraan aktif.
 * Figma #114:1320 "Article - Account Info Card": putih, border 1px #E2E2E2,
 * radius 24, height 168, shadow 0 2px 12 rgba(0,0,0,0.03), berisi
 * ilustrasi kendaraan + teks "This Drive Using {type}" + detail model & plat.
 *
 * Dinamis: Terhubung langsung ke `useVehicle()` sehingga ketika user memilih
 * mobil / motor / sepeda di main page, data dan gambar di sini langsung berganti.
 */
export function SelectedVehicleCard() {
  const { vehicleProfile } = useVehicle();

  return (
    <View
      className="flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-[#E2E2E2] bg-white px-5 pb-5 pt-4 gap-2"
      style={{
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 1,
      }}
    >
      <Image
        source={vehicleProfile.image}
        style={{ width: "100%", height: 108 }}
        contentFit="contain"
        transition={200}
      />

      <View className="items-center gap-0.5">
        <Text className="font-quicksand-bold text-base text-custom-black">
          This Drive Using {vehicleProfile.type}
        </Text>
        <Text className="font-mono text-xs text-slate-500">
          {vehicleProfile.name} • {vehicleProfile.plate}
        </Text>
      </View>
    </View>
  );
}
