import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Expo config untuk HyperGrid.
 *
 * `app.json` tetap menjadi sumber utama config statis. File ini menambah
 * satu hal: API key Google Maps dibaca dari environment variable (lihat
 * `.env.example`) supaya tidak ada secret yang ikut ter-commit.
 *
 * Catatan penting:
 * - Key ini hanya dibutuhkan saat rilis ke app store. Saat development
 *   memakai Expo Go, peta berjalan tanpa konfigurasi tambahan sama sekali.
 * - `react-native-maps` versi yang cocok SDK 54 (1.20.1) belum punya
 *   config plugin, jadi key ditulis lewat field `android.config.googleMaps`
 *   dan `ios.config.googleMapsApiKey` yang memang didukung native build.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

  return {
    ...base,
    android: {
      ...base.android,
      config: {
        ...base.android?.config,
        googleMaps: { apiKey },
      },
    },
    ios: {
      ...base.ios,
      config: {
        ...base.ios?.config,
        googleMapsApiKey: apiKey,
      },
    },
    plugins: [
      ...(base.plugins ?? []).filter(
        // Plugin `expo-maps` sudah tidak dipakai (pindah ke react-native-maps).
        (plugin) => !(Array.isArray(plugin) && plugin[0] === "expo-maps")
      ),
      // Plugin wajib SDK 57. Ditambahkan di sini karena Expo CLI tidak bisa
      // menulis ke dynamic config (`app.config.ts`) secara otomatis.
      "expo-router",
      "expo-splash-screen",
      "expo-web-browser",
    ],
  }
}
