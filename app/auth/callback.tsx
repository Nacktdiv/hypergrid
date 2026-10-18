/**
 * OAuth Callback Handler Screen
 *
 * Route: /auth/callback  →  Deep link: hypergrid://auth/callback
 *
 * Alur kerja:
 * 1. User klik "Sign in with Google" di halaman login
 * 2. @better-auth/expo/client membuka browser in-app (WebBrowser)
 * 3. Google mengautentikasi user dan redirect ke backend:
 *    https://hg-server.onrender.com/api/auth/callback/google
 * 4. Backend Better Auth memvalidasi token, membuat session, lalu
 *    me-redirect browser ke callbackURL (hypergrid://auth/callback)
 * 5. OS menangkap deep link dan membuka screen ini
 * 6. expoClient plugin OTOMATIS menyimpan session token ke SecureStore
 * 7. Screen ini cukup refresh sesi dan redirect ke tujuan
 */

import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function AuthCallback() {
  const router = useRouter();
  const { refreshSession, user, isOnboardingCompleted } = useAuth();

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      // Beri waktu expoClient plugin untuk memproses dan menyimpan token
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Refresh sesi untuk memuat user yang baru login
      await refreshSession();

      if (!mounted) return;

      // Arahkan ke halaman yang sesuai
      if (user) {
        if (!isOnboardingCompleted) {
          router.replace('/(onboarding)');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        // Jika session tidak ditemukan setelah callback, kembali ke login
        router.replace('/(auth)');
      }
    };

    handleCallback();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-custom-white">
      <ActivityIndicator size="large" color="#009EFF" />
      <Text className="mt-4 font-quicksand text-sm text-slate-500">
        Memverifikasi autentikasi...
      </Text>
    </View>
  );
}
