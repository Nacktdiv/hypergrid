import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Storage Abstraction untuk Autentikasi Bearer Token dan Sesi.
 * Menggunakan expo-secure-store pada perangkat mobile (iOS & Android)
 * dengan fallback in-memory/localStorage pada web environment.
 */

const TOKEN_KEY = 'hypergrid_auth_token';
const USER_KEY = 'hypergrid_auth_user';
const DEVICE_ID_KEY = 'hypergrid_persistent_device_id';

let inMemoryToken: string | null = null;
let inMemoryUser: string | null = null;
let inMemoryDeviceId: string | null = null;
let tokenPromise: Promise<string | null> | null = null;

export const tokenStorage = {
  /**
   * Mengambil Unique Device ID yang persisten lintas sesi dan restart app.
   */
  async getDeviceId(): Promise<string> {
    if (inMemoryDeviceId) return inMemoryDeviceId;

    try {
      let id: string | null = null;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          id = window.localStorage.getItem(DEVICE_ID_KEY);
        }
      } else {
        id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      }

      if (id && id.trim().length > 0) {
        inMemoryDeviceId = id;
        return id;
      }

      const newId = `hg-dev-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
      inMemoryDeviceId = newId;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(DEVICE_ID_KEY, newId);
        }
      } else {
        await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
      }

      return newId;
    } catch (err) {
      console.warn('[TokenStorage] Gagal mengelola device ID:', err);
      const fallback = `hg-dev-${Date.now().toString(36)}`;
      inMemoryDeviceId = fallback;
      return fallback;
    }
  },

  /**
   * Menyimpan Bearer Token secara terenkripsi di SecureStore
   */
  async setToken(token: string): Promise<void> {
    inMemoryToken = token;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(TOKEN_KEY, token);
        }
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (error) {
      console.warn('[TokenStorage] Gagal menyimpan token ke SecureStore:', error);
    }
  },

  /**
   * Mengambil Bearer Token aktif dengan deduplikasi pembacaan konkurensi
   */
  async getToken(): Promise<string | null> {
    if (inMemoryToken) return inMemoryToken;
    if (tokenPromise) return tokenPromise;

    tokenPromise = (async () => {
      try {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && window.localStorage) {
            inMemoryToken = window.localStorage.getItem(TOKEN_KEY);
            return inMemoryToken;
          }
        } else {
          const token = await SecureStore.getItemAsync(TOKEN_KEY);
          inMemoryToken = token;
          return token;
        }
      } catch (error) {
        console.warn('[TokenStorage] Gagal mengambil token dari SecureStore:', error);
      } finally {
        tokenPromise = null;
      }
      return inMemoryToken;
    })();

    return tokenPromise;
  },

  /**
   * Menghapus Bearer Token saat sign out
   */
  async clearToken(): Promise<void> {
    inMemoryToken = null;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(TOKEN_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch (error) {
      console.warn('[TokenStorage] Gagal menghapus token dari SecureStore:', error);
    }
  },

  /**
   * Menyimpan Cache Profil Pengguna Aktif
   */
  async setUser(userData: object): Promise<void> {
    const raw = JSON.stringify(userData);
    inMemoryUser = raw;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(USER_KEY, raw);
        }
      } else {
        await SecureStore.setItemAsync(USER_KEY, raw);
      }
    } catch (error) {
      console.warn('[TokenStorage] Gagal menyimpan user info:', error);
    }
  },

  /**
   * Mengambil Cache Profil Pengguna
   */
  async getUser<T = any>(): Promise<T | null> {
    try {
      let raw: string | null = inMemoryUser;
      if (!raw) {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && window.localStorage) {
            raw = window.localStorage.getItem(USER_KEY);
          }
        } else {
          raw = await SecureStore.getItemAsync(USER_KEY);
        }
      }
      if (raw) {
        inMemoryUser = raw;
        return JSON.parse(raw) as T;
      }
    } catch (error) {
      console.warn('[TokenStorage] Gagal parse user cache:', error);
    }
    return null;
  },

  /**
   * Membersihkan semua data auth (token & user)
   */
  async clearAll(): Promise<void> {
    await this.clearToken();
    inMemoryUser = null;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(USER_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(USER_KEY);
      }
    } catch (error) {
      console.warn('[TokenStorage] Gagal clear data:', error);
    }
  },

  /**
   * Status apakah onboarding sudah pernah diselesaikan pengguna
   */
  async isOnboardingCompleted(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem('hypergrid_onboarding_completed') === 'true';
        }
      } else {
        const val = await SecureStore.getItemAsync('hypergrid_onboarding_completed');
        return val === 'true';
      }
    } catch (error) {
      console.warn('[TokenStorage] Gagal mengecek status onboarding:', error);
    }
    return false;
  },

  async setOnboardingCompleted(completed: boolean = true): Promise<void> {
    try {
      const val = completed ? 'true' : 'false';
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('hypergrid_onboarding_completed', val);
        }
      } else {
        await SecureStore.setItemAsync('hypergrid_onboarding_completed', val);
      }
    } catch (error) {
      console.warn('[TokenStorage] Gagal menyimpan status onboarding:', error);
    }
  },
};
