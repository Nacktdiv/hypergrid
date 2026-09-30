import { View } from "react-native";

import { ShockGauge } from "./shock-gauge";
import { TelemetryHeader } from "./telemetry-header";
import { TelemetryRows } from "./telemetry-rows";

/**
 * Isi Bottom overlay HUD — Figma View 1 `Metrix` #114:1412.
 *
 * Card hitam #121212, radius 20px, padding 16px, gap 8px:
 *   1. Header: label + badge Calibration
 *   2. Matrix: Vibration & Speed
 *   3. status bar progress
 */
export function BottomHud() {
  return (
    <View className="gap-2 rounded-[20px] bg-custom-black p-4">
      <TelemetryHeader />
      <TelemetryRows />
      <ShockGauge />
    </View>
  )
}
