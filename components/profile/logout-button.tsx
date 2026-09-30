import { Text, View } from "react-native";
import { LogOut } from "lucide-react-native";

import { Touchable } from "@/components/ui/touchable";

/**
 * Tombol Logout — Figma #114:1362 "Button Logout".
 *
 * Kartu putih, border 1px #E2E2E2, radius 24, padding 16px, gap 20px,
 * teks Quicksand SemiBold 16 Semantic/Danger #EF4444.
 */
export function LogoutButton({ onPress }: { onPress: () => void }) {
  return (
    <Touchable
      accessibilityLabel="Log Out"
      accessibilityRole="button"
      onPress={onPress}
    >
      <View className="flex-row items-center justify-center gap-5 rounded-3xl border border-[#E2E2E2] bg-white px-4 py-4">
        <LogOut size={20} color="#EF4444" />
        <Text className="font-quicksand-semibold text-base text-custom-danger">
          Log Out
        </Text>
      </View>
    </Touchable>
  )
}
