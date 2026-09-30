import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MainMap } from "@/components/main/main-map";
import { PlayButton } from "@/components/main/play-button";
import { VehicleSelector } from "@/components/main/vehicle-selector";
import { type VehicleId } from "@/components/main/mock-data";

/**
 * Main Page (Start).
 *
 * Referensi desain: Figma page "Final Page Mobile" → frame `Main page` #114:1267.
 * Container Figma: padding 16px horizontal + 128px bawah, gap 24px.
 *
 * Interaktif: pemilihan kendaraan (state lokal) dan navigasi ke HUD.
 * Tanpa API, tanpa perhitungan, tanpa sensor.
 */
export default function StartScreen() {
  const [vehicle, setVehicle] = useState<VehicleId>("car")

  return (
    <SafeAreaView className="flex-1 bg-custom-white " edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow gap-6 px-4 pt-4 "
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-chivo-bold text-xl text-black">Main Page</Text>

        <View className="flex-1 min-h-[280px]">
          <MainMap vehicleId={vehicle} />
        </View>

        <VehicleSelector onSelect={setVehicle} selected={vehicle} />

        <PlayButton />
      </ScrollView>
    </SafeAreaView>
  )
}
