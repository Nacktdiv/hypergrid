# HyperGrid — Mobile UI (Frontend)

> **Sistem Pemetaan Kerusakan Jalan Berbasis Crowdsourcing**
>
> Repository ini berisi **hanya sisi antarmuka (UI)** aplikasi mobile HyperGrid, dibangun dengan **React Native + Expo**.

Seluruh layar dikembangkan dalam mode **UI-Only**: mock data statis, tanpa backend/API, tanpa sensor. Lihat [Batasan Arsitektur UI](#5-catatan-arsitektur-ui) untuk aturan main yang wajib dipatuhi.

---

## 1. Overview Proyek

| Aspek | Keterangan |
| --- | --- |
| Nama Aplikasi | HyperGrid |
| Platform | Android, iOS, Web |
| Framework | React Native `0.86.3` + Expo `~57.0.26` |
| Routing | Expo Router `~57.0.24` (file-based routing) |
| Styling | NativeWind `v4` (Tailwind CSS) |
| Peta | `react-native-maps` (termasuk Expo Go) |
| Pola komponen | shadcn-style: `cva` + `cn()` + primitive `@rn-primitives/*` |
| Ikon | `lucide-react-native` |
| Bahasa | TypeScript `~6.0.3` |
| Orientasi | Portrait |

### Alur Navigasi

```
app/index.tsx  (Auth / Login)
   └─> app/(onboarding)  (3 slide + progress bar)
         └─> app/(tabs)  ── 3 tab: Start / History / Profile
                 ├── index.tsx     Main Map & Vehicle Selector
                 ├── history.tsx   Riwayat Perjalanan
                 └── profile.tsx   Profil

         └─> app/ride.tsx  Start Drive Mode — Live HUD
```

Tombol **Let's Go!** di Main Map mengarahkan ke `/ride`. Route `ride` berada **di luar** `(tabs)/` supaya HUD memenuhi layar tanpa navbar — sesuai Figma. **Skip** dan **Next** di onboarding mengarahkan ke `/(tabs)`.

---

## 2. Struktur Folder

```
hypergrid/
├── app/                                # Routes (Expo Router)
│   ├── _layout.tsx                     # Root: font loader, SplashScreen, PortalHost
│   ├── index.tsx                       # Auth / Login
│   ├── (onboarding)/
│   │   ├── _layout.tsx                 # Shell + OnboardingContext + progress bar
│   │   └── index.tsx                   # 3 slide (ganti per `progress`)
│   ├── (tabs)/
│   │   ├── _layout.tsx                 # 3-tab navigation (expo-router/ui, pill pill)
│   │   ├── index.tsx                   # Main Map & Vehicle Selector
│   │   ├── history.tsx                 # Riwayat Perjalanan
│   │   └── profile.tsx                 # Profil
│   └── ride.tsx                        # Start Drive Mode — Live HUD (di luar tabs)
│
├── components/
│   ├── map/                            # Peta (bersama untuk semua fitur)
│   │   ├── map-data.ts                 # Tipe MapData + koordinat dummy + proyeksi web
│   │   ├── hypergrid-map.tsx           # react-native-maps (native)
│   │   ├── hypergrid-map.web.tsx       # Fallback web (Metro pilih otomatis)
│   │   └── static-map-fallback.tsx     # Gambar statis + proyeksi lat/lng
│   ├── main/                           # Main Map
│   │   ├── main-map.tsx                # Wrapper <HypergridMap>
│   │   ├── vehicle-selector.tsx        # Car / Motorcycle / Bicycle
│   │   ├── play-button.tsx             # "Let's Go!"
│   │   └── mock-data.ts
│   ├── ride/                           # Live HUD
│   │   ├── live-map.tsx                # Wrapper <HypergridMap> + redup saat dijeda
│   │   ├── top-floating-bar.tsx        # Back + kartu "Drive Mode"
│   │   ├── bottom-hud.tsx              # Card Metrix (threshold + matrix + progress)
│   │   ├── telemetry-header.tsx        # Label threshold + badge Calibration
│   │   ├── shock-gauge.tsx             # Progress bar level guncangan
│   │   ├── telemetry-rows.tsx          # Baris Vibration & Speed
│   │   ├── drive-actions.tsx           # Stop Drive / Pause
│   │   └── mock-data.ts
│   ├── history/
│   │   ├── day-selector.tsx            # Scroll 7 hari
│   │   ├── metrics-summary.tsx         # 3 kartu metrik
│   │   ├── route-map-preview.tsx       # Peta rute (interactive={false})
│   │   ├── history-item-card.tsx       # Kartu rute
│   │   └── mock-data.ts
│   ├── profile/
│   │   ├── profile-header.tsx          # Judul + avatar 112px + tombol kamera
│   │   ├── selected-vehicle-card.tsx   # Kendaraan aktif (tinggi 168, shadow)
│   │   ├── personal-info-list.tsx      # Group list card
│   │   ├── logout-button.tsx           # Tombol Log Out
│   │   └── mock-data.ts
│   └── ui/                             # Primitive dasar (shadcn-style)
│       ├── button.tsx
│       ├── text.tsx
│       ├── progress.tsx
│       └── touchable.tsx               # Pressable + scale spring
│
├── assets/
│   ├── history/map-base.png            # Peta dasar fallback web (Figma #114:1270)
│   ├── login/hipergrid-final.png       # Ilustrasi Login (Figma #114:1023)
│   ├── profile/avatar-56586a.png       # Avatar (Figma #114:1315)
│   ├── vehicles/
│   │   ├── car.png                     # #114:1282
│   │   ├── vehicle-motor.png           # #114:1285
│   │   ├── vehicle-bicycle.png         # #114:1288
│   │   └── markers/                    # Versi 96px untuk marker peta
│   ├── icons/google.png
│   └── images/                         # Logo, ikon, onboarding 1-3
│
├── lib/
│   ├── theme.ts                        # Token HSL untuk navigasi
│   └── utils.ts                        # Helper `cn()` (clsx + tailwind-merge)
│
├── global.css                          # CSS variables (shadcn tokens)
├── tailwind.config.js                  # Extend: fontFamily + colors.custom
├── app.json                            # Config statis
├── app.config.ts                       # Wrapper dynamic: API key dari env
├── .env.example                        # Contoh Environment (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)
└── components.json                     # shadcn config (bukan Reusables)
```

---

## 3. Design System

### 3.1 Warna

| Token | Hex | Tailwind | Penggunaan |
| --- | --- | --- | --- |
| Primary | `#009EFF` | `custom-primary` | CTA, indikator aktif, progress bar, jalur rute |
| Black | `#121212` | `custom-black` | Surface gelap, Tab Bar, HUD, badge status aman |
| White | `#F8FAFC` | `custom-white` | Background aplikasi |
| Active | `#BAD3F5` | `custom-active` | Pil aktif pada selector kendaraan |
| Border Active | `#009EFF` | `custom-borderActive` | Border elemen terpilih |
| Disabled | `#E9EAEC` | `custom-disabled` | Latar elemen non-interaktif |
| Border Disabled | `#D0D0D0` | `custom-borderDisabled` | Border elemen non-interaktif |
| Danger | `#EF4444` | `custom-danger` | Log Out, marker kerusakan HUD |
| Warning | `#F59E0B` | `custom-warning` | Badge PERINGATAN, marker severity menengah |
| Success | `#10B981` | `custom-success` | Badge status profil |
| Info | `#3B82F6` | `custom-info` | Informasi sekunder |

Warna yang **tidak** ada di palette dan dipakai lewat arbitrary value (sumber: Figma):
`#E2E2E2` (border card), `#CAD5E2` (border map), `#1C1C1E` (judul card),
`#B3261E` (marker peta severity tinggi), `#FFFF00` (marker Figma `Yellow 2`),
`#2985FF` (jalur rute), `#1A73E8` (titik posisi user), `#E2E8F0` (teks card gelap).

### 3.2 Tipografi

| Font | Peran | Token | Weight tersedia |
| --- | --- | --- | --- |
| **Chivo** | Headline, judul layar, branding | `font-chivo`, `font-chivo-bold` | 400, 700 |
| **Quicksand** | Body text, label, tombol, navigasi | `font-quicksand`, `font-quicksand-semibold`, `font-quicksand-bold` | 400, 600, 700 |
| **JetBrains Mono** | Metrik, telemetri, plat, ID | `font-mono`, `font-mono-bold` | 400, 700 |

Semua dimuat di `app/_layout.tsx` lewat `useFonts()`; splash screen ditahan sampai selesai.

Aturan:
- **Chivo** hanya untuk heading dan wordmark.
- **Quicksand** adalah body text default.
- **JetBrains Mono** wajib untuk semua angka telemetri — digit monospasi mencegah angka "bergeser" saat nilai berubah saat-erika.

> Figma banyak memakai **Chivo SemiBold (600)** dan **Inter**, keduanya **tidak** tersedia di `app/_layout.tsx`. Heading Chivo 600 dipetakan ke `font-chivo-bold` (700), dan Inter dipetakan ke Quicksand.

### 3.3 Pola Komponen

Semua komponen mengikuti pola yang sama — `View`/`Pressable` + `cva` + `cn()`, tanpa sistem tema terpisah:

```tsx
import { cn } from "@/lib/utils";

const styles = cva("rounded-3xl border p-5", {
  variants: {
    tone: {
      default: "border-[#E2E2E2] bg-white",
      danger: "border-custom-danger bg-red-50",
    },
  },
});
```

Helper: `cn()` dari `lib/utils.ts`, `PortalHost` dari `@rn-primitives/portal` (sudah di root layout), `SafeAreaView` dari `react-native-safe-area-context`.

---

## 4. Daftar Layar

### 4.1 Auth / Login — `app/index.tsx`

- Ilustrasi `hipergrid_final` 264×280 di tengah
- Headline "Log in to your account" (Chivo 32, center)
- Tombol **Masuk dengan Google** + ikon Google (230px, border `#F3F3F3` 3px)
- Tombol **Settings** circular di kanan bawah (bg `#3B82F6`)
- Navigasi: tombol Google → `/(onboarding)`

### 4.2 Onboarding — `app/(onboarding)/`

Shell di `_layout.tsx`, slide di `index.tsx`. State via `OnboardingContext`.

- Progress bar, 3 tahap
- 3 slide dengan ilustrasi `onboard-1/2/3`, headline Chivo, deskripsi Quicksand
- **Skip** (kanan atas) → `/(tabs)`
- **Next** (primary, lebar penuh) → slide berikutnya, atau `/(tabs)` setelah slide terakhir

### 4.3 Main Map & Vehicle Selector — `app/(tabs)/index.tsx`

Mengikuti Figma `Main page` #114:1267.

```
┌──────────────────────────────┐
│ Main Page                    │  Chivo 20, #000000
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │      PETA NATIVE         │ │  react-native-maps, radius 16
│ │   ①──②──③ jalur biru     │ │  border #CAD5E2
│ │      🚗 + marker 30/21/14│ │  polyline #2985FF + lingkaran 36px
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ ┌────┐ ┌──────┐ ┌──────┐     │  Car aktif: #BAD3F5 + border
│ │Car │ │Moto  │ │Seph │     │  #009EFF; lainnya #E9EAEC
│ └────┘ └──────┘ └──────┘     │
├──────────────────────────────┤
│      [ Let's Go! ]          │  pill biru, radius 48
└──────────────────────────────┘
```

### 4.4 Start Drive Mode / Live HUD — `app/ride.tsx`

Mengikuti Figma `start driving` #114:1384 (View 1). Route ini berada **di luar** `(tabs)/` supaya peta memenuhi layar tanpa navbar.

```
┌──────────────────────────────┐
│ (←)  ┌─ Drive Mode ────────┐ │  bar transparan di atas peta
├──────────────────────────────┤
│                              │
│      PETA NATIVE             │  react-native-maps
│      jalur + marker 30/21/14 │  lingkaran 36px + angka
│      🚗 kendaraan  ● user    │
│                              │
├══════════════════════════════┤ ← card Metrix, radius 20
│ Sensitivity Threshold [Calib]│  label 16 + badge biru
│                              │
│ Vibration        Speed       │  dua kolom
│ 100 m/s2         100 m/s2    │  angka 36px
│ ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░ │  progress bar 12px
├──────────────────────────────┤
│ [⏹ Stop Drive]  [⏸ Pause]    │  tinggi 48, radius 20
└──────────────────────────────┘
```

> View 2 (#114:1431) **tidak** diimplementasikan sebagai mode toggle. Figma memuat V1 dan V2 sebagai dua desain terpisah — bukan satu tampilan dengan dua state — jadi hanya V1 yang dipakai sebagai tampilan default.

### 4.5 History — `app/(tabs)/history.tsx`

```
┌──────────────────────────────┐
│ Riwayat Perjalanan           │  Chivo 20
├──────────────────────────────┤
│ [Sen 22][Sel 23][Rab 24] →   │  scroll; aktif biru solid
├──────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐         │
│ │ 7  │ │14.2│ │ 32 │         │  angka JetBrains Mono
│ │Rusak│ │ KM │ │Mnt │         │
│ └────┘ └────┘ └────┘         │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │      PETA RUTE            │ │  radius 16, interactive={false}
│ │  jalur + marker 30/14/21  │ │  map native, gestur dimatikan
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ Dari ▪ Rumah                 │
│      │                       │
│ Ke   ▪ Kampus ITB    26/08/26│
│      ─────────────────────── │
│ 07:15-07:32     [3 guncangan]│
└──────────────────────────────┘
```

### 4.6 Profile — `app/(tabs)/profile.tsx`

Mengikuti Figma `Profile` #114:1309.

```
┌──────────────────────────────┐
│           Profile            │  Chivo 20, center
│           ┌────┐             │
│           │ ◉  │ 📷          │  avatar 112px, border putih 3px
│           └────┘             │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │  kartu kendaraan, tinggi 168
│ │      🚗  (isometrik)      │ │  radius 24, border #E2E2E2
│ │ This Drive Using Car      │ │  shadow 0 2px 12 rgba(0,0,0,.03)
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ Personal info          Edit  │
│ ✉ Email                      │
│   nadhif.muhammad@gmail.com  │
│ ☎ Nomor HP                   │
│   +62 812-3456-7890          │
│ ▣ ID Driver                  │
│   HG-2024-00817              │
│ ◉ Tipe Sensor Utama          │
│   Smartphone                 │
├──────────────────────────────┤
│      [ ⏻ Log Out        ]   │  kartu putih, teks #EF4444
└──────────────────────────────┘
```

> Nama pengguna, status badge, nomor plat, dan tombol Edit Profil / Pengaturan Aplikasi **dihapus** karena tidak ada di frame `Profile` #114:1309. Figma hanya memuat satu tombol aksi: `Button Logout` #114:1362.

### 4.7 Navigasi 3 Tab — `app/(tabs)/_layout.tsx`

| # | Label | Route | Ikon |
| --- | --- | --- | --- |
| 1 | Start | `/` | `CarFront` |
| 2 | History | `/history` | `RotateCcwClock` |
| 3 | Profile | `/profile` | `User` |

Mengikuti Figma `BottomNavBar (Mobile Only)` #114:1368 persis — 3 link saja. Implementasi memakai `expo-router/ui` (`Tabs` + `TabSlot` + `TabTrigger`) yang dibungkus `CustomTabList` agar styling tetap penuh kendali.

- Bar gelap `custom-black`, `rounded-full`, `mx-5 bottom-8`, padding `px-8 py-2`
- Aktif: ikon `#F8FAFC` + label putih
- Non-aktif: ikon `slate-400` + label `slate-400`
- Lebar ~353px pada layar 393px, mengikuti margin Figma
- Ride HUD berada **di luar** `(tabs)/` supaya memenuhi layar tanpa navbar

---

## 5. Catatan Arsitektur UI

### 5.1 Aturan Utama

> **Dilarang menambahkan logika sensor maupun panggilan API backend pada tahap ini.**

| Kategori | Dilarang | Contoh yang harus dihindari |
| --- | --- | --- |
| **Sensor** | `Accelerometer`, `Gyroscope`, `GPS`, `Location`, `DeviceMotion` | `expo-sensors`, `expo-location`, `expo-task-manager` |
| **Jaringan** | `fetch` / `axios`, WebSocket, GraphQL | `fetch('https://api...')`, `new WebSocket(...)` |
| **Auth** | OAuth Google nyata, token, session server | `expo-auth-session` |
| **Penyimpanan** | Persistensi data ke server | AsyncStorage berisi cache API |
| **Permission** | Request izin lokasi / sensor | `Location.requestForegroundPermissionsAsync()` |

### 5.2 Yang Diperbolehkan

- State lokal React (`useState`, `useContext`)
- Timer/animasi untuk simulasi visual saja
- Navigasi Expo Router (`router.push()`)
- `OnboardingContext` untuk state bersama antar slide

### 5.3 Pola Mock Data

Semua data dummy per-fitur berada di `components/<fitur>/mock-data.ts` — **bukan** di `lib/mock-data.ts`. Konvensi yang dipakai:

- Ekspor konstanta uppercase, grouped dalam `type` bila perlu
- Tambahkan komentar `// TODO: ganti dengan data API saat tahap integrasi`
- Komponen meng-import langsung dari `mock-data.ts` — tidak ada service layer, sehingga penggantian cukup di satu file

```ts
// components/ride/mock-data.ts
// TODO: ganti dengan data sensor saat Tahap 2
export const SPEED = { value: "45", unit: "KM/H" };
export const SHOCK_LEVEL = 62;
```

### 5.4 Panduan Struktur Komponen

- **Satu layar satu file** di `app/`; tambahkan `_layout.tsx` bila butuh shell bersama
- **Ekstrak ke `components/<fitur>/`** bila file layar melewati ±150 baris
- Selalu pakai **`cn()`**, bukan template literal
- Ikon dari **`lucide-react-native`**
- Nama file lowercase dengan tanda hubung: `vehicle-selector.tsx`
- Beri tipe eksplisit pada props, hindari `any`

### 5.5 Persona & Konteks Penggunaan

- Dipakai **di dalam kendaraan yang sedang bergerak**, sering malam, kadang hujan
- Konsekuensi: kontras tinggi, ukuran sentuh besar, informasi kritis terbaca sekilas
- Audiens: pengguna motor/mobil harian — gunakan bahasa lugas
- Keterbacaan dalam gelap dan hujan **selalu menang** atas detail visual
- Hindari teks kecil di atas angka besar, animasi mengganggu, pembeda warna tanpa perbedaan luminance

---

## 6. Menjalankan Aplikasi

### Prasyarat
- Node.js 20 LTS+
- `pnpm` (repo memakai `pnpm-lock.yaml`)
- Expo Go, atau Android Emulator / iOS Simulator

```bash
pnpm install
pnpm start          # dev server
pnpm run android    # build native Android
pnpm run ios        # build native iOS
pnpm run web        # browser
pnpm run lint       # ESLint
```

### Verifikasi Mode UI-Only

```bash
# tidak boleh ada dependency sensor
grep -rniE "expo-sensors|expo-location|Accelerometer|Gyroscope" app components

# tidak boleh ada panggilan jaringan
grep -rniE "axios|fetch\(|XMLHttpRequest|WebSocket" app components
```

Keduanya harus mengembalikan **kosong**. Aplikasi harus bisa di-build, dirender, dan dinavigasi sepenuhnya secara offline.

---

## 7. Status vs Figma `Final Page Mobile`

Figma file: `HyperGrid-Mage` — page **`Final Page Mobile`** (`114:1018`).

| Frame Figma | Node | Route | Status |
| --- | --- | --- | --- |
| `Login` | `114:1019` | `app/index.tsx` | ✅ deviation kecil (lihat 7.1) |
| `Onboarding 2` | `114:1045` | `app/(onboarding)` | ⚠️ konten generik, bukan node itu |
| `Onboarding 5` | `114:1086` | — | ❌ tidak diimplementasikan |
| `Onboarding 6` | `114:1471` | — | ❌ tidak diimplementasikan |
| `Main page` | `114:1267` | `app/(tabs)/index.tsx` | ✅ sesuai |
| `start driving` (V1) | `114:1384` | `app/ride.tsx` | ✅ sesuai |
| `start driving` (V2) | `114:1431` | — | ➖ tidak diimplementasikan (lihat 7.1) |
| `Profile` | `114:1309` | `app/(tabs)/profile.tsx` | ✅ sesuai |
| — | — | `app/(tabs)/history.tsx` | ⚠️ **tidak ada framenya** — disusun dari design language |

### 7.1 Deviation yang diketahui

1. **Login** — sudah diselaraskan penuh ke Figma #114:1019: background `#F8FAFC`, ilustrasi `assets/login/hipergrid-final.png` 264×280, heading Chivo 32 `#0F172A`, label "Masuk dengan Google", tombol Google border `#F3F3F3` 3px radius 10, tombol Settings bg `#3B82F6` radius 50. Yang tersisa: logo + wordmark "HYPERGRID" di header tidak ada di Figma frame ini, dan tombol Settings belum punya aksi.
2. **Onboarding** — Figma tidak memiliki Onboarding 1/2/3; yang ada bernama Onboarding 2/5/6. Implementasi memakai 3 slide generik.
3. **History** — tidak ada frame History di `Final Page Mobile`. Frame `Riwayat` (#45:44) dan `Pilihan Riwayat` (#42:1872) ada di `Page 1`, dan `Page 3` (#55:2694) adalah salinannya — keduanya bergaya neobrutalist gelap yang **bertentangan** dengan design final. Komponen disusun ulang mengikuti language `Main page` + `Profile`.
4. **Ride HUD View 2** — Figma #114:1431 (magnitude + threshold + knob) tidak diimplementasikan sebagai mode toggle, karena V1 dan V2 adalah dua desain terpisah, bukan dua state dari satu tampilan. Hanya V1 yang dipakai.
5. **Tombol HUD** — ikon Figma adalah `IMAGE-SVG` tanpa image fill, tidak bisa diunduh; diganti ikon Lucide.
6. **Font** — Chivo SemiBold (600) dan Inter tidak tersedia; dipetakan ke Chivo Bold (700) dan Quicksand.
7. **Koordinat peta** — Figma memakai koordinat piksel absolut pada gambar statis, yang tidak bisa dipetakan ke geografi nyata. Peta native memakai koordinat dummy koridor Jalan Sudirman, Jakarta.

---

## 8. Tech Stack

| Kategori | Teknologi | Versi |
| --- | --- | --- |
| Runtime | Expo SDK | `~57.0.26` |
| Framework | React Native | `0.86.3` |
| React | React | `19.2.3` |
| Language | TypeScript | `~6.0.3` |
| Routing | Expo Router | `~57.0.24` |
| Peta | react-native-maps | `~1.20.1` |
| Styling | NativeWind | `^4.2.6` |
| CSS | Tailwind CSS | `^3.4.17` |
| Primitive | `@rn-primitives/{portal,progress,slot}` | `^1.5.x` |
| Ikon | Lucide React Native | `^1.39.0` |
| Font | Chivo, Quicksand, JetBrains Mono | `@expo-google-fonts/*` |
| SVG | react-native-svg | `15.15.4` |
| Animasi | react-native-reanimated | `~4.5.1` |
| Class utils | clsx, tailwind-merge, cva | — |
| Entry | `expo-router/entry` | — |

---

## 8.1 Peta

Peta memakai **`react-native-maps`** — library ini sudah termasuk di Expo Go, jadi bisa langsung dites tanpa development build:

```bash
pnpm start        # pindai QR code dengan Expo Go
```

Library `expo-maps` (milik Expo sendiri) sengaja tidak dipakai: statusnya masih alpha dan **tidak tersedia di Expo Go di SDK mana pun**, termasuk SDK 57. `react-native-maps` tersedia sejak SDK 54.

Saat development di Expo Go, konfigurasi tidak diperlukan. Untuk **rilis ke app store**, Google Maps butuh API key:

```bash
cp .env.example .env    # isi EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
npx expo prebuild
```

Key dibaca oleh `app.config.ts` ke `android.config.googleMaps` dan `ios.config.googleMapsApiKey`. iOS bisa memakai Apple Maps sehingga tidak wajib memakai key.

### Struktur data peta

Semua layer peta digambar dari satu tipe di `components/map/map-data.ts`:

```ts
type MapData = {
  camera: LatLng & { zoom: number }
  route: { id: string; coordinates: LatLng[] }
  damagePoints: DamagePoint[]
  userLocation: LatLng
  vehiclePosition: LatLng
}
```

Bentuknya sengaja dibuat mirip payload API. Saat backend siap, ganti konstantanya dengan `fetch` — komponen peta tidak perlu disentuh.

File `hypergrid-map.tsx` dan `hypergrid-map.web.tsx` dipilih otomatis oleh Metro sesuai platform, sehingga `react-native-maps` tidak pernah ter-import saat bundling web. Di browser, peta dirender dari gambar statis memakai proyeksi linier koordinat yang sama.

---

## 9. REFERensi

- [Expo Documentation (SDK 57)](https://docs.expo.dev/versions/v57.0.0/)
- [react-native-maps](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [Expo Router — File-based Routing](https://docs.expo.dev/router/introduction/)
- [NativeWind v4](https://www.nativewind.dev/docs/v4)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## 10. Tahap Berikutnya — Hands-off ke Developer Tahap 2

> **Semua UI telah rampung 100%. Siap untuk tahap integrasi API, Sensor Accelerometer/Gyroscope, dan Logika Business Edge-calculate.**

### 10.1 Yang perlu dikerjakan

**Integrasi API**
- Ganti konstanta di `components/map/map-data.ts` dengan fetch/service call — tipe `MapData` sudah disiapkan untuk payload API
- Ganti seluruh konstanta di `components/*/mock-data.ts` lainnya dengan fetch/service call
- Tambahkan service layer (mis. `lib/api/`) — **jangan** menaburkan `fetch` di komponen
- Tambahkan schema `.env` untuk base URL dan token (`.env.example` sudah ada, tinggal diperluas)

**Sensor**
- Pasang `expo-sensors` (`Accelerometer`, `Gyroscope`) dan `expo-location`
- Ganti `ShockGauge`, `telemetry-header.tsx`, dan `telemetry-rows.tsx` agar membaca nilai sensor, bukan konstanta
- Ganti `userLocation` di `map-data.ts` dengan koordinat nyata + aktifkan `showsUserLocation` pada `MapView`
- Pindahkan calculations ke worker/background task bila telemetri harus jalan saat layar mati
- Peta sudah native (`react-native-maps`) — tidak perlu pekerjaan map SDK lagi

**Logika Business Edge-calculate**
- Baseline adaptif per kendaraan: bandingkan pembacaan accelerometer terkini terhadap baseline yang dipelajari
- Deteksi guncangan jalan dan penskoran severity
- Agregasi rute dan pencocokan dengan laporan kerusakan lain
- Penyimpanan lokal (SQLite / MMKV) untuk riwayat perjalanan

**Navigasi & alur**
- Ganti alur linear `Login → Onboarding → Tabs` dengan auth session sungguhan
- Terapkan proteksi route: pengguna yang belum login diarahkan ke `app/index.tsx`

### 10.2 Prasyarat sebelum mulai

- [ ] `tsc --noEmit` dan `pnpm run lint` bersih
- [ ] Uji manual di Android dan iOS lewat Expo Go (termasuk peta di Main, Drive, dan Riwayat)
- [ ] Audit ulang: `grep -rniE "expo-sensors|axios|fetch\(" app components` harus **kosong**
- [ ] Tetapkan konvensi nama untuk service layer dan hooks sensor
- [ ] Sepakati sumber data untuk baseline adaptif

---

**HyperGrid** — Smarter Roads, Together.
