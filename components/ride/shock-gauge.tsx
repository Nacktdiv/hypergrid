import { View } from "react-native";

import { SHOCK_LEVEL } from "./mock-data";

/**
 * Progress bar level guncangan — Figma View 1 `status bar` #114:1428.
 *
 * Tinggi 12px, radius 48px, track Secondary/Light #E2E8F0, border putih 1px.
 * Isi progress Primary #009EFF (Figma #114:1429, 59px dari 329px ≈ 18%).
 *
 * Murni visual: nilai level berasal dari konstanta dummy, tidak ada
 * sensor, tidak ada animasi real-time.
 */
export function ShockGauge() {
  return (
    <View className="h-3 w-full overflow-hidden rounded-full border border-white bg-slate-200">
      <View
        className="h-full rounded-full bg-custom-primary"
        style={{ width: `${SHOCK_LEVEL}%` }}
      />
    </View>
  )
}
