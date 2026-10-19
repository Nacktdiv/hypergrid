import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Konfigurasi Base URL HyperGrid REST API.
 * Mendukung:
 * 1. Runtime override via dialog pengaturan di aplikasi (in-memory)
 * 2. Environment variable EXPO_PUBLIC_API_URL
 * 3. Auto-detection IP host dari Expo dev server (misal: 192.168.1.8) untuk HP fisik Expo Go
 * 4. Loopback emulator/simulator fallback (Android 10.0.2.2, iOS localhost)
 */

let runtimeApiBaseUrl: string | null = null;

export const setRuntimeApiBaseUrl = (url: string | null) => {
  runtimeApiBaseUrl = url;
};

/**
 * Mengambil IP host komputer pengembangan dari Expo dev server (Metro).
 * Pada Expo Go (perangkat fisik), `hostUri` berisi alamat IP komputer LAN (misal: "192.168.1.8:8081").
 */
export const getExpoHostIp = (): string | null => {
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  } catch {
    // Abaikan jika tidak tersedia
  }
  return null;
};

const normalizeApiUrl = (url: string): string => {
  const clean = url.trim().replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

export const getApiBaseUrl = (): string => {
  // 1. Cek runtime manual override dari tombol Settings
  if (runtimeApiBaseUrl) {
    return normalizeApiUrl(runtimeApiBaseUrl);
  }

  // 2. Cek variabel lingkungan .env
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return normalizeApiUrl(envUrl);
  }

  // 3. Auto-detect IP LAN jika berjalan di perangkat Expo Go (HP fisik atau emulator yang terhubung ke Metro)
  const expoHostIp = getExpoHostIp();
  if (expoHostIp) {
    return `http://${expoHostIp}:4000/api`;
  }

  // 4. Fallback emulator / web
  if (Platform.OS === 'android') {
    // 10.0.2.2 adalah loopback host komputer pada Android Emulator resmi (AVD)
    return 'http://10.0.2.2:4000/api';
  } else if (Platform.OS === 'ios') {
    return 'http://localhost:4000/api';
  } else {
    return 'http://localhost:4000/api';
  }
};

/**
 * Mendapatkan Base URL Auth Better-Auth
 * (Root path autentikasi: `/api/auth`)
 */
export const getAuthBaseUrl = (): string => {
  const base = getApiBaseUrl();
  return `${base}/auth`;
};

export const API_TIMEOUT_MS = 45000;

/**
 * Mengirim request ringan ke root API untuk membangunkan instance cloud server
 * (menangani Render.com free-tier spin-down cold-start secara proaktif saat app dibuka).
 */
export const warmupServer = async (): Promise<void> => {
  try {
    const base = getApiBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    await fetch(`${base}/pothole-clusters?limit=1`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch {
    // Abaikan background warmup jika gagal
  }
};
