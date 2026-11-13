import { ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider } from "@/contexts/auth-context";
import { AppThemeProvider, useAppTheme } from "@/contexts/theme-context";
import { VehicleProvider } from "@/contexts/vehicle-context";
import { NAV_THEME } from "@/lib/theme";
import "@/services/background-tracking";
import "../global.css";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { warmupServer } from "@/services/api/config";

SplashScreen.preventAutoHideAsync();

function RootNavigation() {
  const { resolvedTheme, isDark, colors } = useAppTheme();

  return (
    <NavigationThemeProvider value={NAV_THEME[resolvedTheme]}>
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: colors.canvas }}
      >
        <View
          className={isDark ? "dark flex-1" : "flex-1"}
          style={{ backgroundColor: colors.canvas }}
        >
          <StatusBar style={isDark ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
              animationDuration: 180,
              freezeOnBlur: true,
              contentStyle: { backgroundColor: colors.canvas },
            }}
          >
            <Stack.Screen name="index" options={{ animation: "none" }} />
            <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
            <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
            <Stack.Screen
              name="ride"
              options={{
                animation: "fade_from_bottom",
                animationDuration: 180,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen name="(onboarding)" />
            {/* Route handler untuk deep link callback OAuth (hypergrid://auth/callback) */}
            <Stack.Screen name="auth/callback" />
          </Stack>
          <PortalHost />
        </View>
      </GestureHandlerRootView>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // Bangunkan server cloud saat aplikasi dibuka
  useEffect(() => {
    warmupServer();
  }, []);

  if (!loaded && !error) {
    return null;
  }

  return (
    <AppThemeProvider>
      <AuthProvider>
        <VehicleProvider>
          <RootNavigation />
        </VehicleProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}