import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Settings } from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Touchable } from "@/components/ui/touchable";

/**
 * Auth / Login.
 *
 * Referensi desain: Figma page "Final Page Mobile" → frame `Login` #114:1019.
 *   - background White C #F8FAFC (bukan `bg-white` murni)
 *   - ilustrasi `hipergrid_final` #114:1023, 264×280
 *   - heading "Log in to your account" Chivo Bold 32, center, #0F172A
 *   - tombol "Masuk dengan Google", isi White C, border #F3F3F3 3px, radius 10
 *   - tombol Settings di kanan bawah, bg #3B82F6, radius 50
 *
 * Tombol Google baru placeholder — navigasi ke onboarding. TODO: integrasikan
 * `expo-auth-session` saat Tahap 2.
 */
export default function Index() {
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-custom-white">
      <View className="flex-1 items-center justify-center gap-12 px-4">
        {/* Ilustrasi — Figma `hipergrid_final 1` #114:1023 (264×280) */}
        <Image
          contentFit="contain"
          source={require("@/assets/login/hipergrid-final.png")}
          style={{ height: 280, width: 264 }}
        />

        <Text
          className="text-center font-chivo-bold text-[32px] leading-[38px] text-[#0F172A]"
        >
          Log in to your account
        </Text>

        {/* Figma `Google` #114:1032 — border #F3F3F3 3px, radius 10 */}
        <Touchable
          accessibilityHint="Lanjut ke onboarding"
          accessibilityLabel="Masuk dengan Google"
          accessibilityRole="button"
          onPress={() => router.push("/(onboarding)")}
        >
          <View className="w-[230px] flex-row items-center justify-center gap-4 rounded-[10px] border-[3px] border-[#F3F3F3] bg-custom-white px-2 py-2">
            <Image
              contentFit="contain"
              source={require("@/assets/icons/google.png")}
              style={{ height: 24, width: 24 }}
            />
            <Text className="font-quicksand text-base text-[#0F172A]">
              Masuk dengan Google
            </Text>
          </View>
        </Touchable>
      </View>

      {/* Tombol Settings — Figma `Setting` #155:133 (bg #3B82F6, radius 50) */}
      <View className="absolute bottom-0 right-0 flex-row items-center justify-end p-4">
        <View className="h-[46px] w-[47px] items-center justify-center rounded-full bg-[#3B82F6]">
          <Settings color="#F8FAFC" size={24} />
        </View>
      </View>
    </SafeAreaView>
  )
}
