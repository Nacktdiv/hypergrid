import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Appearance, AppState, Platform } from "react-native";

import { APP_COLORS, type AppThemeColors } from "@/lib/theme/tokens";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "@hypergrid/theme_preference";

interface ThemeContextValue {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  colors: AppThemeColors;
  setThemePreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalizeSystemScheme(
  value: ReturnType<typeof Appearance.getColorScheme>
): ResolvedTheme {
  return value === "dark" ? "dark" : "light";
}

function isValidThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Provides persisted System/Light/Dark appearance management and syncs
 * NativeWind + React Native Appearance listeners atomically.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { setColorScheme: setNativeWindColorScheme } = useNativeWindColorScheme();
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>("system");
  const [systemScheme, setSystemScheme] = useState<ResolvedTheme>(() =>
    normalizeSystemScheme(Appearance.getColorScheme())
  );
  const preferenceRef = useRef<ThemePreference>("system");

  const applyNativeAppearance = useCallback(
    (nextPref: ThemePreference) => {
      try {
        setNativeWindColorScheme(nextPref);
      } catch {
        // NativeWind web fallback guard when CSS flag is initializing
      }

      if (Platform.OS !== "web" && typeof Appearance.setColorScheme === "function") {
        try {
          if (nextPref === "system") {
            const rnMinor =
              (Platform.constants as { reactNativeVersion?: { minor?: number } } | undefined)
                ?.reactNativeVersion?.minor ?? 0;
            Appearance.setColorScheme(rnMinor >= 82 ? "unspecified" : null);
          } else {
            Appearance.setColorScheme(nextPref);
          }
        } catch {
          // Safe no-op on unsupported platform versions
        }
      }
    },
    [setNativeWindColorScheme]
  );

  // Hydrate persisted user preference once at startup without blocking render.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!active || !isValidThemePreference(stored)) return;
        preferenceRef.current = stored;
        setThemePreferenceState(stored);
        applyNativeAppearance(stored);
      })
      .catch(() => {
        // Keep system default if storage read fails
      });
    return () => {
      active = false;
    };
  }, [applyNativeAppearance]);

  // Track OS appearance updates only when the user chose "system",
  // ignoring synthetic events emitted by our own Appearance.setColorScheme calls.
  useEffect(() => {
    const syncSystemScheme = () => {
      if (preferenceRef.current === "system") {
        setSystemScheme(normalizeSystemScheme(Appearance.getColorScheme()));
      }
    };

    const appearanceSub = Appearance.addChangeListener(({ colorScheme }) => {
      if (preferenceRef.current === "system") {
        setSystemScheme(normalizeSystemScheme(colorScheme));
      }
    });

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncSystemScheme();
      }
    });

    return () => {
      appearanceSub.remove();
      appStateSub.remove();
    };
  }, []);

  const setThemePreference = useCallback(
    (nextPref: ThemePreference) => {
      preferenceRef.current = nextPref;
      setThemePreferenceState(nextPref);
      applyNativeAppearance(nextPref);
      if (nextPref === "system") {
        setSystemScheme(normalizeSystemScheme(Appearance.getColorScheme()));
      }
      AsyncStorage.setItem(THEME_STORAGE_KEY, nextPref).catch(() => {});
    },
    [applyNativeAppearance]
  );

  const resolvedTheme: ResolvedTheme =
    themePreference === "system" ? systemScheme : themePreference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      isDark: resolvedTheme === "dark",
      colors: APP_COLORS[resolvedTheme],
      setThemePreference,
    }),
    [themePreference, resolvedTheme, setThemePreference]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used inside AppThemeProvider");
  }
  return ctx;
}

export function useOptionalTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  const fallbackScheme = normalizeSystemScheme(Appearance.getColorScheme());
  return {
    themePreference: "system",
    resolvedTheme: fallbackScheme,
    isDark: fallbackScheme === "dark",
    colors: APP_COLORS[fallbackScheme],
    setThemePreference: () => {},
  };
}
