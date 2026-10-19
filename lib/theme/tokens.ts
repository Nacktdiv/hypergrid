/**
 * Design system tokens for HyperGrid Mobile.
 * Centralized color palette, border radii, shadows, and spacing.
 */

export const TOKENS = {
  colors: {
    brand: {
      DEFAULT: "#009EFF",
      hover: "#0084D9",
      light: "#E0F2FE",
      dark: "#0369A1",
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
      950: "#080C14",
    },
    status: {
      success: "#10B981",
      successLight: "#ECFDF5",
      warning: "#F59E0B",
      warningLight: "#FFFBEB",
      danger: "#EF4444",
      dangerLight: "#FEF2F2",
      info: "#009EFF",
      infoLight: "#E0F2FE",
    },
    surface: {
      canvas: "#F8FAFC",
      card: "#FFFFFF",
      sheet: "#FFFFFF",
      subtle: "#F1F5F9",
      dark: "#0F172A",
      darkCard: "#182032",
    },
    border: {
      DEFAULT: "#E2E8F0",
      subtle: "#F1F5F9",
      active: "#009EFF",
      dark: "#1E293B",
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
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.04,
      shadowRadius: 10,
      elevation: 3,
    },
    card: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    float: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 6,
    },
    glow: {
      shadowColor: "#009EFF",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 6,
    },
  },
} as const;

export type DesignTokens = typeof TOKENS;
