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

import { useAppTheme } from "@/contexts/theme-context";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function AuthCallback() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { refreshSession, user, isOnboardingCompleted } = useAuth();

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await refreshSession();

      if (!mounted) return;

      if (user) {
        if (!isOnboardingCompleted) {
          router.replace("/(onboarding)");
        } else {
          router.replace("/(tabs)");
        }
      } else {
        router.replace("/(auth)");
      }
    };

    handleCallback();

    return () => {
      mounted = false;
    };
    // Run exactly once on mount to finalize OAuth redirect callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: colors.canvas }}
    >
      <ActivityIndicator size="large" color={colors.brand} />
      <Text
        className="mt-4 font-inter text-sm"
        style={{ color: colors.textMuted }}
      >
        Verifying authentication...
      </Text>
    </View>
  );
}
