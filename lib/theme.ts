import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { APP_COLORS, TOKENS } from './theme/tokens';

export { APP_COLORS, TOKENS };

export const THEME = {
  light: {
    background: APP_COLORS.light.canvas,
    foreground: APP_COLORS.light.text,
    card: APP_COLORS.light.card,
    cardForeground: APP_COLORS.light.text,
    popover: APP_COLORS.light.card,
    popoverForeground: APP_COLORS.light.text,
    primary: APP_COLORS.light.brand,
    primaryForeground: '#FFFFFF',
    secondary: APP_COLORS.light.subtle,
    secondaryForeground: APP_COLORS.light.text,
    muted: APP_COLORS.light.subtle,
    mutedForeground: APP_COLORS.light.textMuted,
    accent: APP_COLORS.light.brandSoft,
    accentForeground: APP_COLORS.light.text,
    destructive: APP_COLORS.light.danger,
    border: APP_COLORS.light.border,
    input: APP_COLORS.light.border,
    ring: APP_COLORS.light.brand,
    radius: '0.875rem',
    chart1: 'hsl(210 100% 52%)',
    chart2: 'hsl(160 84% 39%)',
    chart3: 'hsl(38 92% 50%)',
    chart4: 'hsl(0 84% 60%)',
    chart5: 'hsl(215 16% 47%)',
  },
  dark: {
    background: APP_COLORS.dark.canvas,
    foreground: APP_COLORS.dark.text,
    card: APP_COLORS.dark.card,
    cardForeground: APP_COLORS.dark.text,
    popover: APP_COLORS.dark.card,
    popoverForeground: APP_COLORS.dark.text,
    primary: APP_COLORS.dark.brand,
    primaryForeground: '#FFFFFF',
    secondary: APP_COLORS.dark.subtle,
    secondaryForeground: APP_COLORS.dark.text,
    muted: APP_COLORS.dark.subtle,
    mutedForeground: APP_COLORS.dark.textMuted,
    accent: APP_COLORS.dark.brandSoft,
    accentForeground: APP_COLORS.dark.text,
    destructive: APP_COLORS.dark.danger,
    border: APP_COLORS.dark.border,
    input: APP_COLORS.dark.border,
    ring: APP_COLORS.dark.brand,
    radius: '0.875rem',
    chart1: 'hsl(210 100% 58%)',
    chart2: 'hsl(160 84% 48%)',
    chart3: 'hsl(38 92% 56%)',
    chart4: 'hsl(0 84% 65%)',
    chart5: 'hsl(215 20% 65%)',
  },
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};