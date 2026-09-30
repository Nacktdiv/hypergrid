import { Text, View } from "react-native";

import { SHOCK_METRICS } from "./mock-data";

/**
 * Header baris Metrix — Figma `Name` #114:1413 / #114:1460.
 *
 * Label "Sensitivity Threshold" di kiri + badge "Calibration" di kanan
 * (View 1) atau "Back" (View 2). Badge: bg Primary #009EFF, radius 16,
 * padding 6px, teks hitam Quicksand Medium 13.
 */
export function TelemetryHeader() {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-quicksand-semibold text-base text-white">
        {SHOCK_METRICS.threshold}
      </Text>

      <View className="rounded-2xl bg-custom-primary px-3 py-1.5">
        <Text className="font-quicksand-semibold text-xs text-black">
          {SHOCK_METRICS.baselineStatus}
        </Text>
      </View>
    </View>
  )
}
