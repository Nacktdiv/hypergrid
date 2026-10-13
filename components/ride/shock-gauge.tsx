import { View } from "react-native";

import { SHOCK_LEVEL } from "./mock-data";

/**
 * Progress bar level guncangan — Figma View 1 `status bar` #114:1428.
 *
 * Tinggi 12px, radius 48px, track Secondary/Light #E2E8F0, border putih 1px.
 * Isi progress Primary #009EFF.
 * Mendukung persentase dinamis dari perhitungan Edge AI (0-100%).
 */
export function ShockGauge({ level = SHOCK_LEVEL }: { level?: number } = {}) {
  const clampedLevel = Math.max(0, Math.min(100, level));

  return (
    <View className="h-3 w-full overflow-hidden rounded-full border border-white bg-slate-200">
      <View
        className="h-full rounded-full bg-custom-primary"
        style={{ width: `${clampedLevel}%` }}
      />
    </View>
  );
}
