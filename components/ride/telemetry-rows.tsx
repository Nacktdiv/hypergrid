import { Text, View } from "react-native";

import { TELEMETRY_ROWS } from "./mock-data";

/**
 * Baris telemetry — Figma View 1 `Matrix` #114:1417.
 *
 * Dua kolom: label (Quicksand 12, putih) di atas,
 * angka besar Quicksand SemiBold 36 + unit Quicksand SemiBold 16 di bawah.
 * Value di-hardcode di mock-data.
 */
export function TelemetryRows() {
  return (
    <View className="flex-row gap-2.5">
      {TELEMETRY_ROWS.map((row) => (
        <View key={row.id} className="flex-1 gap-2">
          <Text className="font-quicksand-semibold text-xs text-white">
            {row.label}
          </Text>

          <View className="flex-row items-baseline gap-2">
            <Text className="font-quicksand-semibold text-4xl text-white">
              {row.value}
            </Text>
            <Text className="font-quicksand-semibold text-base text-white">
              {row.unit}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}
