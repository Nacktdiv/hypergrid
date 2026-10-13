# HyperGrid — AI Road Damage Detection & Spatial Mapping

> A React Native (Expo) mobile platform for real-time road damage detection, live GPS tracking, and spatial mapping powered by on-device AI and a NestJS + PostGIS backend.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Google OAuth Setup](#google-oauth-setup)
- [App Architecture](#app-architecture)
- [Authentication Flow](#authentication-flow)
- [Screens & Features](#screens--features)
- [Folder Structure](#folder-structure)
- [Troubleshooting](#troubleshooting)

---

## Overview

HyperGrid is a field officer mobile app designed to:

- **Detect road damage** in real time using the device accelerometer and on-device edge AI
- **Map potholes & road defects** spatially using GPS breadcrumb tracking with `react-native-maps`
- **Log and review** ride history with spatial analytics
- **Sync data** to a NestJS + PostGIS REST backend via Better-Auth authenticated API calls

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Expo SDK 57 / React Native 0.86 |
| **Navigation** | Expo Router v57 (file-based, typed routes) |
| **Styling** | NativeWind v4 (Tailwind CSS for React Native) |
| **Auth** | Better-Auth (email/password + Google OAuth) |
| **Storage** | `expo-secure-store` (mobile) / `localStorage` (web) |
| **Sensors** | `expo-sensors` (Accelerometer), `expo-location` (GPS) |
| **Maps** | `react-native-maps` + PostGIS backend |
| **UI Fonts** | Chivo, Quicksand, JetBrains Mono (Google Fonts) |
| **Backend** | NestJS + PostGIS (separate repo) |

---

## Prerequisites

Make sure these are installed on your machine before starting:

| Tool | Version | Install |
|---|---|---|
| **Node.js** | ≥ 20 LTS | [nodejs.org](https://nodejs.org) |
| **pnpm** | ≥ 9 | `npm i -g pnpm` |
| **Expo CLI** | latest | `npm i -g expo` |
| **EAS CLI** (optional) | latest | `npm i -g eas-cli` |
| **Android Studio** | Ladybug+ | For Android Emulator (AVD) |
| **Xcode** | ≥ 15 (macOS only) | For iOS Simulator |
| **Expo Go** | latest | [App Store](https://apps.apple.com/app/expo-go/id982107779) / [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) |

---

## Project Setup

### 1. Clone the repository

```bash
git clone https://github.com/nacktdiv/hypergrid.git
cd hypergrid
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values (see [Environment Variables](#environment-variables) below).

### 4. Start the backend server

HyperGrid requires the NestJS backend running locally or on a server. Refer to the backend repo for setup instructions. By default the app expects the API at:

- **Android Emulator:** `http://10.0.2.2:4000/api`
- **iOS Simulator / Web:** `http://localhost:4000/api`
- **Physical Device (Expo Go):** auto-detected from Metro host IP → `http://<your-lan-ip>:4000/api`

> **Tip:** You can also change the API URL at runtime using the ⚙️ **Settings** button on the Login screen — no rebuild needed.

---

## Environment Variables

Create a `.env` file at the project root (copy from `.env.example`):

```env
# Base URL of the HyperGrid NestJS REST API
# Append /api — e.g. http://192.168.1.10:4000/api
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api
```

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Optional | Overrides the auto-detected backend URL. Useful for physical devices or remote dev servers. |

> **Note:** If `EXPO_PUBLIC_API_URL` is not set, the app auto-detects the backend from the Expo Metro host IP. For physical devices on the same Wi-Fi network, this works out of the box.

---

## Running the App

### Development (Expo Go — fastest, no build needed)

```bash
# Start Metro bundler
pnpm start

# Or with platform flag
pnpm android   # Android Emulator or connected device
pnpm ios       # iOS Simulator (macOS only)
pnpm web       # Browser
```

Then scan the QR code with **Expo Go** on your phone, or press `a` / `i` in the terminal.

### Physical Device — Important Network Note

When running on a physical device via Expo Go, your phone and dev machine **must be on the same Wi-Fi network**. The app auto-detects your machine's LAN IP from the Expo Metro server and builds the API URL automatically.

If auto-detection fails, use the in-app ⚙️ Settings button on the Login screen to manually set the Base URL (e.g., `http://192.168.1.100:4000`).

### Native Build (EAS / local)

For sensors (accelerometer, GPS) to work correctly on a physical device without Expo Go:

```bash
# Android
eas build --platform android --profile development
# or local
expo run:android

# iOS (macOS only)
eas build --platform ios --profile development
# or local
expo run:ios
```

---

## Google OAuth Setup

Google sign-in requires additional setup — **it will NOT work without this step**.

### Step 1 — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Navigate to **APIs & Services → Credentials → OAuth 2.0 Client IDs**
3. Open your OAuth client and add all of the following to **Authorized redirect URIs**:

| Environment | Redirect URI |
|---|---|
| Expo Go (Android LAN) | `exp://192.168.x.x:8081/--/auth/callback` |
| Expo Go (localhost) | `exp://localhost:8081/--/auth/callback` |
| Android Emulator | `exp://10.0.2.2:8081/--/auth/callback` |
| Standalone / EAS build | `hypergrid://auth/callback` |
| Web (dev) | `http://localhost:8081/auth/callback` |

> **Tip:** To find the exact redirect URI your app is sending, add `console.log('[OAuth] callbackURL:', Linking.createURL('/auth/callback'))` to `services/api/auth.service.ts` line 61 and check the Metro logs.

### Step 2 — Backend Better-Auth Config

Ensure your NestJS backend's Better-Auth config allows the same redirect URIs listed above. Add them to the `trustedOrigins` or `callbackURLs` list in your Better-Auth configuration.

---

## App Architecture

```
app/
├── _layout.tsx          # Root layout — AuthProvider + Stack navigator
├── index.tsx            # Gateway: redirects based on auth + onboarding state
├── ride.tsx             # Live ride/drive mode screen
├── (auth)/
│   └── index.tsx        # Login / Register screen
├── (tabs)/
│   ├── _layout.tsx      # Bottom tab navigator (Start, History, Profile)
│   ├── index.tsx        # Main dashboard / map screen
│   ├── history.tsx      # Ride history log
│   └── profile.tsx      # Officer profile & logout
└── (onboarding)/
    └── _layout.tsx      # 3-step onboarding flow (shown once per device)
```

### State Management

- **`contexts/auth-context.tsx`** — Global auth state (`AuthProvider` + `AuthRouteGuard`)
- **`AuthRouteGuard`** — Reactive middleware that watches route segments and redirects automatically on login/logout/session expiry
- **`services/api/token-storage.ts`** — Persistent storage for token, user, and onboarding flag via `expo-secure-store`

---

## Authentication Flow

```
App Launch
    │
    ▼
app/index.tsx (gateway)
    │
    ├─ No token ──────────────────────► /(auth)  [Login / Register]
    │                                       │
    │                                       ├─ Email Sign In ──► /(tabs) or /(onboarding)
    │                                       ├─ Email Sign Up ──► /(onboarding)
    │                                       └─ Google Sign In ─► /(tabs) or /(onboarding)
    │
    ├─ Token + onboarding not done ──► /(onboarding)  [3-step, shown once]
    │                                       │
    │                                       └─ Finish / Skip ──► /(tabs)
    │
    └─ Token + onboarding done ──────► /(tabs)  [Main app]
                                           │
                                           └─ Logout ──► /(auth)  [auto by AuthRouteGuard]
```

**Onboarding persistence:** The onboarding completion flag is stored independently of the auth token. Once a user completes onboarding on a device, they will **never** see it again, even after logging out and back in.

---

## Screens & Features

| Screen | Route | Description |
|---|---|---|
| **Login / Register** | `/(auth)` | Email + password auth, Google OAuth sign-in, server URL settings |
| **Onboarding** | `/(onboarding)` | 3-step intro shown once after first registration on a device |
| **Dashboard** | `/(tabs)` | Live map with road damage clusters, start ride button |
| **Ride Mode** | `/ride` | Full-screen HUD — live GPS tracking, accelerometer shock detection, edge AI damage classification |
| **History** | `/(tabs)/history` | Past ride logs with spatial data and shock metrics |
| **Profile** | `/(tabs)/profile` | Officer info, settings, logout |

---

## Folder Structure

```
hypergrid/
├── app/                    # Expo Router screens & layouts
├── assets/                 # Images, icons, fonts
├── components/
│   ├── history/            # History screen components
│   ├── main/               # Dashboard components
│   ├── map/                # Map data and overlays
│   ├── profile/            # Profile screen components
│   ├── ride/               # Ride HUD components (sensor data, AI status)
│   └── ui/                 # Reusable primitives (Button, Touchable, Progress, etc.)
├── contexts/
│   └── auth-context.tsx    # Global auth state + route guard middleware
├── hooks/
│   ├── use-auth.ts         # Auth hook (re-exports from context)
│   ├── use-edge-ai.ts      # On-device AI damage classification hook
│   ├── use-pothole-clusters.ts  # Spatial cluster data hook
│   └── use-user-location.ts     # GPS location hook
├── services/
│   └── api/
│       ├── auth.service.ts      # Better-Auth API calls
│       ├── auth-events.ts       # Event bus for session expiry (401)
│       ├── client.ts            # Axios API client with auth interceptor
│       ├── config.ts            # Base URL resolution (env, runtime, auto-detect)
│       ├── health.service.ts    # Backend health check
│       ├── offline-queue.ts     # Offline data sync queue
│       └── token-storage.ts     # SecureStore abstraction
├── types/
│   └── api.ts              # TypeScript types for API payloads
├── app.json                # Expo project config (scheme: hypergrid)
├── tailwind.config.js      # NativeWind / Tailwind configuration
└── tsconfig.json           # TypeScript configuration
```

---

## Troubleshooting

### API not reachable on physical device

Use the ⚙️ Settings button on the Login screen to manually enter the backend URL as `http://<your-machine-lan-ip>:4000`. Make sure your phone and machine are on the same Wi-Fi network.

### Google OAuth: `redirect_uri_mismatch` (Error 400)

The redirect URI your app sends must be registered in Google Cloud Console. See [Google OAuth Setup](#google-oauth-setup) above.

### Sensors not working (accelerometer / GPS)

- `expo-sensors` and `expo-location` require a **native build** or **Expo Go** — they do not work in the browser (`pnpm web`).
- On physical devices, grant **Location** and **Motion** permissions when prompted.
- On Android emulators, GPS must be enabled in the AVD settings.

### Session expired loop

If the app keeps bouncing back to login, your server session token has likely expired. Sign out manually and sign in again. The `AuthRouteGuard` middleware handles this automatically by listening to `401` responses from the API.

### TypeScript errors

```bash
npx tsc --noEmit
```

### Lint

```bash
pnpm lint
```

---

> Built with ❤️ by the HyperGrid team. Powered by Expo, NativeWind, Better-Auth, and PostGIS.
