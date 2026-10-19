const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        chivo: ["Chivo_400Regular"],
        "chivo-bold": ["Chivo_700Bold"],

        quicksand: ["Quicksand_400Regular"],
        "quicksand-semibold": ["Quicksand_600SemiBold"],
        "quicksand-bold": ["Quicksand_700Bold"],

        mono: ["JetBrainsMono_400Regular"],
        "mono-bold": ["JetBrainsMono_700Bold"],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        brand: {
          DEFAULT: '#009EFF',
          hover: '#0084D9',
          light: '#E0F2FE',
          dark: '#0369A1',
        },
        surface: {
          canvas: '#F8FAFC',
          card: '#FFFFFF',
          sheet: '#FFFFFF',
          subtle: '#F1F5F9',
          dark: '#0F172A',
          'dark-card': '#182032',
        },
        status: {
          success: '#10B981',
          'success-light': '#ECFDF5',
          warning: '#F59E0B',
          'warning-light': '#FFFBEB',
          danger: '#EF4444',
          'danger-light': '#FEF2F2',
          info: '#009EFF',
          'info-light': '#E0F2FE',
        },
        custom: {
          white: "#F8FAFC",
          black: "#0F172A",
          primary: '#009EFF',
          active: '#E0F2FE',
          borderActive: '#009EFF',
          disabled: '#F1F5F9',
          borderDisabled: '#E2E8F0',
          danger: '#EF4444',
          warning: '#F59E0B', 
          success: '#10B981',
          info: '#009EFF',
        }
      },
      borderRadius: {
        sheet: '28px',
        card: '20px',
        item: '14px',
        pill: '9999px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

