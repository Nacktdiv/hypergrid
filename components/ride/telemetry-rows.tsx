import { Text, View } from "react-native";

import { TELEMETRY_ROWS } from "./mock-data";

/**
 * Baris telemetry — Figma View 1 `Matrix` #114:1417.
 *
 * Dua kolom: Vibration & Speed.
 * Mendukung nilai dinamis dari sensor / Edge AI maupun fallback default.
 */
export function TelemetryRows({
  speed,
  vibration,
}: {
  speed?: number | string;
  vibration?: number | string;
} = {}) {
  const displayRows = TELEMETRY_ROWS.map((row) => {
    if (row.id === "speed" && speed !== undefined) {
      return { ...row, value: String(speed) };
    }
    if (row.id === "vibration" && vibration !== undefined) {
      return { ...row, value: String(vibration) };
    }
    return row;
  });

  return (
    <View className="flex-row gap-2.5">
      {displayRows.map((row) => (
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
  );
}
