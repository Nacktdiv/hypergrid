/**
 * Design system tokens for HyperGrid Mobile.
 * Centralized color palette, border radii, shadows, and spacing.
 */

export const TOKENS = {
  colors: {
    brand: {
      DEFAULT: "#0A84FF",
      hover: "#0070E0",
      light: "#E6F2FF",
      dark: "#0066CC",
    },
    slate: {
      50: "#F8FAFC",
      100: "#F1F5F9",
      200: "#E2E8F0",
      300: "#CBD5E1",
      400: "#94A3B8",
      500: "#64748B",
      600: "#475569",
      700: "#334155",
      800: "#1E293B",
      900: "#0F172A",
      950: "#090B10",
    },
    status: {
      success: "#10B981",
      successLight: "#ECFDF5",
      warning: "#F59E0B",
      warningLight: "#FFFBEB",
      danger: "#EF4444",
      dangerLight: "#FEF2F2",
      info: "#0A84FF",
      infoLight: "#E6F2FF",
    },
    surface: {
      canvas: "#F4F6F9",
      card: "#FFFFFF",
      sheet: "#FFFFFF",
      subtle: "#EEF2F6",
      dark: "#090B10",
      darkSheet: "#10131A",
      darkCard: "#151922",
      darkSubtle: "#1E2430",
    },
    border: {
      DEFAULT: "#E2E8F0",
      subtle: "#F1F5F9",
      active: "#0A84FF",
      dark: "#232936",
    },
    text: {
      primary: "#0F172A",
      secondary: "#475569",
      muted: "#94A3B8",
      inverse: "#FFFFFF",
    },
  },
  radii: {
    sheet: 28,
    card: 20,
    item: 14,
    pill: 9999,
    xs: 6,
  },
  shadows: {
    sheet: {
      shadowColor: "#090B10",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    card: {
      shadowColor: "#090B10",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    float: {
      shadowColor: "#090B10",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
      elevation: 6,
    },
    glow: {
      shadowColor: "#0A84FF",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 6,
    },
  },
} as const;

export interface AppThemeColors {
  canvas: string;
  sheet: string;
  card: string;
  cardMuted: string;
  subtle: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  tabBar: string;
  tabBorder: string;
  pill: string;
  overlay: string;
  brand: string;
  brandPressed: string;
  brandText: string;
  brandSoft: string;
  brandBorder: string;
  danger: string;
  dangerSoft: string;
  dangerText: string;
  warning: string;
  warningSoft: string;
  warningText: string;
  success: string;
  successSoft: string;
  successText: string;
}

export const APP_COLORS: Record<"light" | "dark", AppThemeColors> = {
  light: {
    canvas: "#F4F6F9",
    sheet: "#FFFFFF",
    card: "#FFFFFF",
    cardMuted: "#F8FAFC",
    subtle: "#EEF2F6",
    border: "#E2E8F0",
    borderStrong: "#CBD5E1",
    text: "#0F172A",
    textSecondary: "#334155",
    textMuted: "#64748B",
    textSubtle: "#475569",
    tabBar: "#FFFFFF",
    tabBorder: "#E2E8F0",
    pill: "rgba(255, 255, 255, 0.96)",
    overlay: "rgba(15, 23, 42, 0.45)",
    brand: "#0A84FF",
    brandPressed: "#0070E0",
    brandText: "#0066CC",
    brandSoft: "#E6F2FF",
    brandBorder: "#B3D7FF",
    danger: "#EF4444",
    dangerSoft: "#FEF2F2",
    dangerText: "#DC2626",
    warning: "#F59E0B",
    warningSoft: "#FFFBEB",
    warningText: "#B45309",
    success: "#10B981",
    successSoft: "#ECFDF5",
    successText: "#047857",
  },
  dark: {
    canvas: "#090B10",
    sheet: "#10131A",
    card: "#151922",
    cardMuted: "#1A1F2B",
    subtle: "#1E2430",
    border: "#232936",
    borderStrong: "#313A4D",
    text: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    textSubtle: "#94A3B8",
    tabBar: "#0B0E14",
    tabBorder: "#1E2430",
    pill: "rgba(16, 19, 26, 0.95)",
    overlay: "rgba(0, 0, 0, 0.68)",
    brand: "#0A84FF",
    brandPressed: "#0070E0",
    brandText: "#389CFF",
    brandSoft: "rgba(10, 132, 255, 0.16)",
    brandBorder: "rgba(10, 132, 255, 0.35)",
    danger: "#F87171",
    dangerSoft: "rgba(239, 68, 68, 0.16)",
    dangerText: "#FCA5A5",
    warning: "#FBBF24",
    warningSoft: "rgba(245, 158, 11, 0.16)",
    warningText: "#FCD34D",
    success: "#34D399",
    successSoft: "rgba(16, 185, 129, 0.16)",
    successText: "#6EE7B7",
  },
};

export type DesignTokens = typeof TOKENS;
