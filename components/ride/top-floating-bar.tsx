import { Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";

import { Touchable } from "@/components/ui/touchable";

/**
 * Top floating bar — Figma `Header` #114:1396 / #114:1443.
 *
 * Row: tombol back bulat putih (radius 100px, shadow lembut) + kartu
 * rute "Drive Mode" (Chivo 600 20, isi Black C #121212, radius 16).
 * Overlay semi-transparan agar map tetap terlihat di belakangnya.
 */
export function TopFloatingBar({ onBack }: { onBack?: () => void }) {
  return (
    <View className="flex-row items-center gap-4">
      {/* Back button — Figma `back button` #114:1397 */}
      <Touchable
        accessibilityLabel="Kembali"
        accessibilityRole="button"
        onPress={onBack}
      >
        <View
          className="h-12 w-12 items-center justify-center rounded-full bg-white"
          style={{
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
          }}
        >
          <ChevronLeft size={24} color="#121212" />
        </View>
      </Touchable>

      {/* Kartu rute — Figma `Title` #114:1398 */}
      <View className="h-12 flex-1 flex-row items-center justify-center rounded-2xl bg-black/85 px-6">
        <Text className="font-chivo-bold text-xl text-white">
          Drive Mode
        </Text>
      </View>
    </View>
  )
}
