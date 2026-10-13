import { PortalHost } from '@rn-primitives/portal';
import { useEffect } from "react";
import { SplashScreen, Stack } from "expo-router";
import { AuthProvider } from "@/contexts/auth-context";
import "../global.css";

import {
  useFonts,
  Chivo_400Regular,
  Chivo_700Bold,
} from "@expo-google-fonts/chivo";
import {
  Quicksand_400Regular,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from "@expo-google-fonts/quicksand";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";

SplashScreen.preventAutoHideAsync();

function RootNavigation() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="ride" />
      <Stack.Screen name="(onboarding)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Chivo_400Regular,
    Chivo_700Bold,
    Quicksand_400Regular,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <AuthProvider>
      <RootNavigation />
      <PortalHost />
    </AuthProvider>
  );
}