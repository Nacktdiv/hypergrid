import { PortalHost } from '@rn-primitives/portal';
import { useEffect } from "react";
import { SplashScreen, Stack } from "expo-router";
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
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <PortalHost />
    </>
  );
}