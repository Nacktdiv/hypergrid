import { Text, View } from "react-native";
import { CircleStop, Pause, Play } from "lucide-react-native";

import { Touchable } from "@/components/ui/touchable";

/**
 * Aksi cepat — Figma `Button Dual` #114:1400 / #114:1447.
 *
 * Dua tombol setinggi 48px. Masing-masing tombol isi Black C #121212,
 * radius 20px, padding 12px 24px, gap 16px:
 *   - kiri  "Stop Drive"  teks Semantic/Danger #EF4444
 *   - kanan "Pause"       teks Secondary/Light #E2E8F0
 *
 * Ikon di Figma adalah IMAGE-SVG tanpa image fill, jadi memakai
 * `lucide-react-native` yang sudah dipakai screen lain.
 */
export function DriveActions({
  isPaused,
  onStop,
  onTogglePause,
}: {
  isPaused: boolean
  onStop: () => void
  onTogglePause: () => void
}) {
  return (
    <View className="flex-row gap-4">
      <ActionButton
        label="Stop Drive"
        icon={<CircleStop size={24} color="#EF4444" />}
        labelClassName="text-custom-danger"
        onPress={onStop}
      />

      <ActionButton
        label={isPaused ? "Resume" : "Pause"}
        icon={
          isPaused ? (
            <Play size={24} color="#E2E8F0" />
          ) : (
            <Pause size={24} color="#E2E8F0" />
          )
        }
        labelClassName="text-[#E2E8F0]"
        onPress={onTogglePause}
      />
    </View>
  )
}

function ActionButton({
  label,
  icon,
  labelClassName,
  onPress,
}: {
  label: string
  icon: React.ReactNode
  labelClassName?: string
  onPress: () => void
}) {
  return (
    <Touchable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="flex-1"
      onPress={onPress}
    >
      <View className="h-12 flex-row items-center justify-center gap-4 rounded-[20px] bg-custom-black px-6">
        {icon}
        <Text className={`font-quicksand-semibold text-base ${labelClassName}`}>
          {label}
        </Text>
      </View>
    </Touchable>
  )
}
