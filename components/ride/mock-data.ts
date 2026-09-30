/**
 * Dummy data untuk Live Tracking HUD (Start Drive Mode — View 1 & View 2).
 *
 * Referensi desain: Figma page "Final Page Mobile"
 *   - View 1 (collapsed)  `start driving` #114:1384 → `Metrix` #114:1412
 *   - View 2 (expanded)   `start driving` #114:1431 → `Metrix` #114:1459
 *
 * PENTING: file ini murni data tampilan. Tidak ada hook sensor
 * (accelerometer / gyroscope / geolocation), tidak ada kalkulasi EMA,
 * tidak ada adaptive baseline. Semua angka adalah konstanta dummy.
 */

/** Mobil aktif di peta — Figma `Isometric Car Icon 2` #155:165 (vektor) */
export const CAR_IMAGE = require("@/assets/vehicles/car.png")

export type DriveStatus = "safe" | "warning" | "speeding"

/**
 * Status kondisi SenaWA.
 * Figma sendiri tidak punya badge ini — berasal dari spec, jadi warna
 * diambil dari semantic token yang sudah ada di Figma:
 *   - safe     "AMAN"           biru Primary #009EFF
 *   - warning  "PERINGATAN"     Semantic/Warning #F59E0B
 *   - speeding "TERLALU CEPAT"  Semantic/Danger #EF4444
 */
export const STATUS_META: Record<
  DriveStatus,
  { label: string; color: string; textColor: string }
> = {
  safe: { label: "AMAN", color: "#009EFF", textColor: "#FFFFFF" },
  warning: { label: "PERINGATAN", color: "#F59E0B", textColor: "#000000" },
  speeding: { label: "TERLALU CEPAT", color: "#EF4444", textColor: "#FFFFFF" },
}

/** Status aktif untuk demo */
export const ACTIVE_STATUS: DriveStatus = "warning"

/** Telemetri utama — kecepatan digital */
export const SPEED = {
  value: "45",
  unit: "KM/H",
}

/** Level guncangan (0-100) untuk progress bar */
export const SHOCK_LEVEL = 62

/** Detail metrik guncangan untuk expanded state (View 2) */
export const SHOCK_METRICS = {
  /** Magnitude guncangan saat ini, Figma `5` m/s2 */
  magnitude: "5",
  unit: "m/s2",
  /** Status baseline — Figma badge "Calibration" #114:1416 */
  baselineStatus: "Calibration",
  /** Ambang batas sensitivitas, untuk label slider */
  threshold: "Sensitivity Threshold",
}

/** Baris telemetry yang tampil di collapsed state (Figma View 1 #114:1417) */
export const TELEMETRY_ROWS = [
  { id: "vibration", label: "Vibration", value: "100", unit: "m/s2" },
  { id: "speed", label: "Speed", value: "100", unit: "m/s2" },
]

/** Baris detail tambahan untuk expanded state (Screen 8) */
export const SHOCK_DETAIL_ROWS = [
  { id: "peak", label: "Peak Magnitude", value: "8.4", unit: "m/s2" },
  { id: "avg", label: "Avg Magnitude", value: "3.1", unit: "m/s2" },
  { id: "events", label: "Events Recorded", value: "12", unit: "×" },
  { id: "baseline", label: "Baseline Status", value: "Calibration", unit: "" },
]
