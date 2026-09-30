import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomHud } from "@/components/ride/bottom-hud";
import { DriveActions } from "@/components/ride/drive-actions";
import { LiveMap } from "@/components/ride/live-map";
import { TopFloatingBar } from "@/components/ride/top-floating-bar";
import { Touchable } from "@/components/ui/touchable";

/**
 * Start Drive Mode (Live Tracking HUD).
 *
 * Referensi desain: Figma page "Final Page Mobile" → `start driving` #114:1384.
 * Tampil saat tombol "Let's Go!" di Main Page diklik.
 *
 * Berada di luar `(tabs)/` agar memenuhi layar tanpa navbar — sesuai Figma.
 *
 * Interaktif: tombol back, pause/resume, dan stop.
 * Tanpa API, tanpa perhitungan, tanpa sensor — semua angka tetap
 * konstanta dummy dari `components/ride/mock-data.ts`.
 */
export default function RideScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [isPaused, setIsPaused] = useState(false)
  const [isFinished, setIsFinished] = useState(false)

  return (
    <View className="flex-1 bg-custom-black">
      <LiveMap isPaused={isPaused} />

      <View className="absolute inset-0">
        <View className="px-4" style={{ paddingTop: insets.top + 12 }}>
          <TopFloatingBar onBack={() => router.back()} />
        </View>

        <View
          className="absolute inset-x-0 bottom-0 gap-3"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="px-4">
            <BottomHud />
          </View>

          <View className="px-4">
            <DriveActions
              isPaused={isPaused}
              onStop={() => setIsFinished(true)}
              onTogglePause={() => setIsPaused((value) => !value)}
            />
          </View>

          {isFinished ? (
            <FinishBanner onDismiss={() => setIsFinished(false)} />
          ) : null}
        </View>
      </View>
    </View>
  )
}

/**
 * Banner konfirmasi setelah "Stop Drive" ditekan.
 * TODO: ganti dengan navigasi ke ringkasan perjalanan saat backend siap.
 */
function FinishBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View className="mx-4">
      <View className="rounded-2xl border-2 border-custom-danger bg-custom-black p-4">
        <Text className="font-quicksand-semibold text-sm text-white">
          Perjalanan dihentikan.
        </Text>
        <Text className="mt-1 text-xs text-slate-400">
          Ringkasan perjalanan belum tersedia pada tahap UI.
        </Text>

        <Touchable
          accessibilityLabel="Tutup banner"
          className="mt-3 self-start"
          onPress={onDismiss}
        >
          <View className="rounded-full border border-slate-600 px-4 py-1.5">
            <Text className="text-xs text-slate-300">Tutup</Text>
          </View>
        </Touchable>
      </View>
    </View>
  )
}
