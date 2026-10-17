import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './config';

/**
 * Universal SecureStore adapter for Expo Client.
 * Implements both synchronous and asynchronous access for iOS/Android Keychain
 * with localStorage fallback for web environment.
 */
export const secureStoreAdapter = {
  getItem: (key: string): string | null => {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(key)
          : null;
      } catch {
        return null;
      }
    }
    try {
      return SecureStore.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch {}
      return;
    }
    try {
      SecureStore.setItem(key, value);
    } catch {}
  },
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(key)
          : null;
      } catch {
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch {}
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
};

/**
 * Better-Auth official client instance configured for Expo React Native.
 */
export const authClient = createAuthClient({
  baseURL: getApiBaseUrl().replace(/\/api\/?$/, ''),
  basePath: '/api/auth',
  plugins: [
    expoClient({
      scheme: 'hypergrid',
      storage: secureStoreAdapter,
      storagePrefix: 'hypergrid_auth',
    }),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
