import { Text, View } from "react-native";
import { Link } from "expo-router";

import { Touchable } from "@/components/ui/touchable";

/**
 * Tombol aksi utama — Figma `Button Play` #114:1290.
 * Tinggi 48px, radius 48px, bg Primary #009EFF, border 2px Primary,
 * teks "Let's Go!" putih SemiBold 16.
 * Navigasi ke HUD live tracking di `/ride`.
 */
export function PlayButton() {
  return (
    <Link href="/ride" asChild>
      <Touchable
        accessibilityLabel="Mulai perjalanan"
        accessibilityRole="button"
      >
        <View className="h-12 w-full items-center justify-center rounded-full border-2 border-custom-primary bg-custom-primary">
          <Text className="text-center font-quicksand-semibold text-base text-white">
            Let&apos;s Go!
          </Text>
        </View>
      </Touchable>
    </Link>
  )
}
