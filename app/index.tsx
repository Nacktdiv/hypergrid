import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/contexts/auth-context";

/**
 * Root Gateway / Traffic Controller:
 * Mengarahkan pengguna secara deterministik berdasarkan sesi token & status onboarding.
 * - Belum login / tidak ada token -> redirect ke `/(auth)`
 * - Sudah login tapi belum onboarding -> redirect ke `/(onboarding)`
 * - Sudah login & onboarding selesai -> redirect ke `/(tabs)`
 */
export default function RootIndex() {
  const { user, isAuthenticated, isLoading, isOnboardingCompleted } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#009EFF" />
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect href="/(auth)" />;
  }

  if (!isOnboardingCompleted) {
    return <Redirect href="/(onboarding)" />;
  }

  return <Redirect href="/(tabs)" />;
}
