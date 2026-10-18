import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useVehicle } from "@/contexts/vehicle-context";
import { MainMap } from "@/components/main/main-map";
import { PlayButton } from "@/components/main/play-button";
import { VehicleSelector } from "@/components/main/vehicle-selector";

/**
 * Main Page (Start).
 *
 * Referensi desain: Figma page "Final Page Mobile" → frame `Main page` #114:1267.
 * Container Figma: padding 16px horizontal + 128px bawah, gap 24px.
 *
 * Interaktif: pemilihan kendaraan dan peta navigasi spasial PostGIS.
 */
export default function StartScreen() {
  const { vehicleId, setVehicle } = useVehicle();

  return (
    <SafeAreaView className="flex-1 bg-custom-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow gap-6 px-4 pt-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-chivo-bold text-xl text-black">Main Page</Text>

        {/* Container Peta dengan Tinggi Eksplisit agar MapView tidak kolaps di ScrollView */}
        <View className="w-full flex-1">
          <MainMap vehicleId={vehicleId} />
        </View>

        <VehicleSelector onSelect={setVehicle} selected={vehicleId} />

        <PlayButton />
      </ScrollView>
    </SafeAreaView>
  );
}
