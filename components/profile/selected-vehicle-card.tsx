import { Image } from "expo-image";
import { Text, View } from "react-native";

import { VEHICLE } from "./mock-data";

/**
 * Selected Vehicle Card — kartu kendaraan aktif.
 * Figma #114:1320 "Article - Account Info Card": putih, border 1px #E2E2E2,
 * radius 24, height 168, shadow 0 2px 12 rgba(0,0,0,0.03), berisi
 * ilustrasi mobil isometrik #114:1322 + teks "This Drive Using Car".
 */
export function SelectedVehicleCard() {
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
        source={VEHICLE.image}
        style={{ width: "100%", height: 108 }}
        contentFit="contain"
        transition={200}
      />

      <Text className="font-quicksand-bold text-base text-custom-black">
        This Drive Using {VEHICLE.type}
      </Text>
    </View>
  )
}
