import { useAuth } from "@/contexts/auth-context";
import { useAppTheme } from "@/contexts/theme-context";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

/**
 * Root Gateway / Traffic Controller
 */
export default function RootIndex() {
  const { user, isAuthenticated, isLoading, isOnboardingCompleted } = useAuth();
  const { colors } = useAppTheme();

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.canvas }}
      >
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect href="/(auth)" />;
  }

  const isUserOnboarded = Boolean(user?.isOnboarded || isOnboardingCompleted);
  if (!isUserOnboarded) {
    return <Redirect href="/(onboarding)" />;
  }

  return <Redirect href="/(tabs)" />;
}
