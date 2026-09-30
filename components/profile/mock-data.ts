/**
 * Dummy data untuk Halaman Profile (Screen 9).
 * Referensi desain: Figma "Final Page Mobile" → frame `Profile` #114:1309.
 * Statis — tanpa API, tanpa auth, tanpa logika sign-out.
 */

export type Profile = {
  name: string
  /** Badge status di bawah nama */
  status: string
  avatar: number
}

export const PROFILE: Profile = {
  name: "Muhammad Nadhif",
  status: "Contributer Level 3",
  avatar: require("@/assets/profile/avatar-56586a.png"),
}

export type Vehicle = {
  /** Jenis kendaraan */
  type: string
  /** Nama kendaraan */
  name: string
  /** Nomor plat */
  plate: string
  /** Ilustrasi dari Figma node #114:1322 */
  image: number
}

export const VEHICLE: Vehicle = {
  type: "Car",
  name: "Toyota Agya 1.2 G AT",
  plate: "B 1284 UZH",
  image: require("@/assets/vehicles/car.png"),
}

export type PersonalInfoField = {
  id: string
  label: string
  value: string
  icon: "email" | "phone" | "driver" | "sensor"
}

export const PERSONAL_INFO: PersonalInfoField[] = [
  { id: "email", label: "Email", value: "nadhif.muhammad@gmail.com", icon: "email" },
  { id: "phone", label: "Nomor HP", value: "+62 812-3456-7890", icon: "phone" },
  { id: "driver", label: "ID Driver", value: "HG-2024-00817", icon: "driver" },
  { id: "sensor", label: "Tipe Sensor Utama", value: "Smartphone", icon: "sensor" },
]
