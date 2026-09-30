/**
 * Dummy data untuk Main Page (Start).
 *
 * Referensi desain: Figma page "Final Page Mobile" → frame `Main page` #114:1267.
 * Statis — tanpa API, tanpa state management, tanpa logika sensor.
 */

/** Ikon vehicular, diunduh dari Figma node #114:1282 / #114:1285 / #114:1288 */
export const VEHICLE_IMAGES = {
  car: require("@/assets/vehicles/car.png"),
  motor: require("@/assets/vehicles/vehicle-motor.png"),
  bicycle: require("@/assets/vehicles/vehicle-bicycle.png"),
}

export type VehicleId = keyof typeof VEHICLE_IMAGES

export type VehicleOption = {
  id: VehicleId
  /** Label tombol — persis seperti di Figma */
  label: string
  image: number
  /** Plat kendaraan, untuk tampilan ringkas */
  plate: string
}

/**
 * Selector kendaraan — Figma #114:1280 "Vechile".
 * State terpilih dikelola di level screen (`useState`), bukan di dalam data.
 */
export const VEHICLE_OPTIONS: VehicleOption[] = [
  { id: "car", label: "Car", image: VEHICLE_IMAGES.car, plate: "B 1284 UZH" },
  { id: "motor", label: "Motorcycle", image: VEHICLE_IMAGES.motor, plate: "B 2941 KJS" },
  { id: "bicycle", label: "Bicycle", image: VEHICLE_IMAGES.bicycle, plate: "B 7710 TRX" },
]

export type MapMarker = {
  id: string
  /** Posisi relatif 0-1 terhadap map card */
  x: number
  y: number
  /** Angka di dalam lingkaran — JetBrains Mono Bold 16 */
  count: number
  /** Warna fill lingkaran */
  color: string
  /** Warna teks di dalam lingkaran */
  textColor: string
}
