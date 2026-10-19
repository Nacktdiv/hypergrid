# 1.2. Peta Struktur Direktori & File Proyek

> **Bagian:** `01-architecture` • [⬅️ Gambaran Sistem](./01-system-overview.md) • [🏠 Indeks Utama](../README.md) • [Alur Data End-to-End ➡️](./03-end-to-end-data-flow.md)

---

## 1. Struktur Pohon Direktori Lengkap (`hypergrid/`)

Repositori aplikasi mobile HyperGrid dirancang dengan arsitektur modular yang memisahkan **tampilan rute (`app/`)**, **komponen UI (`components/`)**, **mesin kecerdasan buatan (`edge-ai/`)**, **state global (`contexts/`)**, **logika bisnis/hooks (`hooks/`)**, dan **layanan jaringan/background (`services/`)**.

```text
hypergrid/
├── .agents/                                  # Dokumentasi Arsitektur & Spesifikasi Sistem Berjenjang
│   ├── README.md                             # Peta navigasi utama dokumentasi
│   ├── 01-architecture/                      # Dokumentasi arsitektur sistem, struktur repo & alur data
│   ├── 02-edge-ai-sensor/                    # Dokumentasi sinyal 20Hz, 47 fitur, TFLite & kalibrasi kendaraan
│   ├── 03-backend-api/                       # Dokumentasi endpoint REST API, PostGIS, Auth & Offline Queue
│   ├── 04-mobile-features-ui/                # Dokumentasi Background Service, Peta, HUD & Design System
│   ├── 05-history-and-roadmap/               # Dokumentasi Changelog (Fase 1-7) & Roadmap Produksi
│   └── skills/                               # Aturan best-practice React Native / Expo untuk AI Agent
│
├── app/                                      # Layer Navigasi & Layar (Expo Router File-Based Routing)
│   ├── _layout.tsx                           # Root Provider: Font loading, AuthProvider, VehicleProvider, Idle Tracking
│   ├── index.tsx                             # Root Entry Gate: Redirect cerdas ke Onboarding / Login / Main Tabs
│   ├── ride.tsx                              # Layar Live Drive HUD: Akuisisi sensor 20Hz, Edge AI, & Early Warning
│   ├── (auth)/
│   │   └── index.tsx                         # Layar Login & Sign-Up (Email/Password, Google OAuth, Server URL Modal)
│   ├── (onboarding)/
│   │   ├── _layout.tsx                       # Stack layout khusus onboarding
│   │   └── index.tsx                         # Carousel pengenalan fitur dengan sinkronisasi status ke database
│   ├── (tabs)/
│   │   ├── _layout.tsx                       # Konfigurasi Bottom Tab Bar (Start, History, Profile)
│   │   ├── index.tsx                         # Tab Start: Peta klaster publik + Google Maps-style Swipeable Drawer
│   │   ├── history.tsx                       # Tab History: Riwayat deteksi terisolasi per-user & filter kalender
│   │   └── profile.tsx                       # Tab Profile: Kartu kendaraan aktif, statistik akun, edit profil & logout
│   └── auth/
│       └── callback.tsx                      # Penangan redirect deep-link OAuth (hypergrid://auth/callback)
│
├── components/                               # Layer Komponen Antarmuka Modular
│   ├── main/                                 # Komponen Halaman Utama (Start Tab)
│   │   ├── main-map.tsx                      # Peta klaster PostGIS se-kota, filter status, & modal detail Read-Only
│   │   ├── cluster-radial-card.tsx           # Kartu visualisasi radial tingkat keparahan & skor prioritas klaster
│   │   ├── vehicle-selector.tsx              # Pemilih profil kendaraan interaktif (Mobil, Motor, Sepeda)
│   │   └── play-button.tsx                   # Tombol utama pemicu sesi berkendara (Start Drive)
│   ├── ride/                                 # Komponen Layar Live Drive HUD
│   │   ├── live-map.tsx                      # Peta pelacakan langsung dengan jejak polyline & marker kendaraan dinamis
│   │   ├── bottom-hud.tsx                    # Kokpit bawah: Spidometer terkalibrasi, G-Force, & SlideCommit Stop
│   │   ├── top-floating-bar.tsx              # Bar status atas: Indikator akurasi GPS, status Edge AI & durasi
│   │   ├── shock-gauge.tsx                   # Bar indikator visual guncangan vertikal real-time
│   │   ├── telemetry-header.tsx              # Header profil kendaraan & ambang batas sensor aktif
│   │   ├── telemetry-rows.tsx                # Baris indikator numerik telemetri (Speed, Vibration, Anomaly Count)
│   │   ├── drive-actions.tsx                 # Tombol kontrol cepat saat sesi berkendara
│   │   └── trip-completed-view.tsx           # Layar ringkasan akhir perjalanan pasca-berkendara
│   ├── history/                              # Komponen Layar Riwayat Perjalanan
│   │   ├── day-selector.tsx                  # Bar pemilih 7 hari terakhir + modal kalender bulanan lengkap
│   │   ├── metrics-summary.tsx               # Kartu 3 metrik harian (Total Anomali, Rata-rata Akurasi, Puncak G)
│   │   ├── route-map-preview.tsx             # Pratinjau peta titik deteksi & garis perjalanan pada hari terpilih
│   │   ├── history-item-card.tsx             # Kartu rincian setiap titik lubang jalan yang terekam
│   │   └── date-utils.ts                     # Fungsi utilitas konversi tanggal lokal (YYYY-MM-DD) bebas bug UTC
│   ├── profile/                              # Komponen Layar Profil Pengguna
│   │   ├── profile-header.tsx                # Komponen foto profil, nama, email, dan lencana pengguna
│   │   ├── selected-vehicle-card.tsx         # Kartu visual kendaraan aktif (Avanza / Vario / Polygon) & spek sensor
│   │   ├── personal-info-list.tsx            # Daftar biodata pengguna & modal pembaruan profil
│   │   └── logout-button.tsx                 # Tombol keluar akun dengan dialog konfirmasi
│   ├── map/                                  # Komponen Inti Engine Peta
│   │   ├── leaflet-map.tsx                   # Bridge WebView Leaflet.js untuk merender peta, marker, & polyline
│   │   ├── vehicle-assets-base64.ts          # Gambar ikon kendaraan Base64 untuk kustomisasi marker lokasi user
│   │   ├── map-data.ts                       # Tipe data titik kerusakan (DamagePoint) dan konfigurasi kamera peta
│   │   ├── hypergrid-map.tsx                 # Abstraksi komponen peta untuk Android/iOS
│   │   └── hypergrid-map.web.tsx             # Abstraksi komponen peta untuk lingkungan Web
│   └── ui/                                   # Komponen Primitif Design System
│       ├── app-button.tsx                    # Komponen tombol standar multi-varian
│       ├── app-card.tsx                      # Komponen kontainer kartu permukaan gelap (Dark Surface)
│       ├── slide-commit.tsx                  # Slider konfirmasi geser (mencegah penekanan tombol Stop tak sengaja)
│       ├── status-badge.tsx                  # Lencana status semantik (Active, Verified, Repaired, Severity)
│       ├── metric-pill.tsx                   # Kapsul metrik ringkas dengan ikon
│       ├── top-floating-header.tsx           # Header melayang transparan di atas peta
│       ├── action-row.tsx                    # Baris navigasi/pengaturan standar
│       └── touchable.tsx                     # Wrapper sentuhan dengan efek tekan yang seragam
│
├── contexts/                                 # Layer Manajemen State Global
│   ├── auth-context.tsx                      # State autentikasi, sinkronisasi onboarding DB, & injeksi userId ke AI
│   └── vehicle-context.tsx                   # State kendaraan terpilih & profil konstanta fisika sensor
│
├── edge-ai/                                  # Layer Mesin Kecerdasan Buatan Tepi (On-Device Edge AI)
│   ├── tflite-model.ts                       # Singleton manajemen memori & eksekusi model hg_model_v2.tflite
│   ├── feature-extractor.ts                  # Filter gravitasi 3D Causal EMA & ekstraksi 47 fitur kinematik
│   ├── detector.ts                           # Orkestrator inferensi 3-Tier, pre-filter gate, & pengiriman API
│   ├── model-config.ts                       # Konfigurasi window (1500ms), frekuensi (20Hz), & threshold (0.50)
│   ├── fast-tflite-mock.ts                   # Modul simulasi aman jika native JSI TFLite tidak tersedia
│   ├── fast-tflite.d.ts                      # Definisi tipe TypeScript untuk react-native-fast-tflite
│   ├── types.ts                              # Kontrak tipe data sensor mentah, buffer window, & output deteksi
│   └── index.ts                              # Ekspor terpusat modul Edge AI
│
├── hooks/                                    # Layer Custom React Hooks
│   ├── use-auth.ts                           # Hook konsumen AuthContext
│   ├── use-edge-ai.ts                        # Hook pengelola buffer jendela sensor & pemicu evaluasi TFLite
│   ├── use-user-location.ts                  # Hook pelacakan GPS, filter kecepatan EMA, & pembaca lokasi background
│   ├── use-pothole-clusters.ts               # Hook pengambilan klaster publik & polling peringatan dini (Nearby)
│   └── use-detections.ts                     # Hook riwayat deteksi dengan pola cache Stale-While-Revalidate
│
├── services/                                 # Layer Layanan Jaringan, Penyimpanan & Background Task
│   ├── background-tracking.ts                # Layanan TaskManager & Foreground Service ('driving' & 'idle')
│   └── api/
│       ├── config.ts                         # Manajer URL API dinamis (mendukung perubahan IP server saat runtime)
│       ├── client.ts                         # Klien HTTP terpusat dengan injeksi Bearer Token & penanganan 401
│       ├── auth.service.ts                   # Pemanggil endpoint autentikasi & pembaruan status onboarding
│       ├── detections.service.ts             # Pemanggil endpoint deteksi tunggal, batch, & riwayat per-user
│       ├── clusters.service.ts               # Pemanggil endpoint klaster spasial & pencarian radius terdekat
│       ├── offline-queue.ts                  # Manajer antrean deteksi offline berbasis AsyncStorage & batch flush
│       ├── history-storage.ts                # Manajer cache riwayat deteksi lokal untuk pemuatan instan (0ms)
│       ├── token-storage.ts                  # Wrapper enkripsi penyimpanan token & preferensi di SecureStore
│       └── auth-events.ts                    # Bus event internal untuk sinyal sesi kedaluwarsa (401 Unauthorized)
│
├── lib/                                      # Layer Utilitas & Konfigurasi Tema
│   ├── theme/tokens.ts                       # Definisi token warna, tipografi, radius, dan bayangan Design System
│   ├── theme.ts                              # Helper tema aplikasi
│   └── utils.ts                              # Fungsi penggabung class styling (clsx / tailwind-merge)
│
├── types/                                    # Layer Definisi Tipe Data Global
│   ├── api.ts                                # Skema TypeScript untuk seluruh respons & request REST API Backend
│   └── index.ts                              # Barrel file ekspor tipe
│
├── assets/                                   # Layer Aset Biner & Media
│   ├── models/hg_model_v2.tflite             # File biner model TensorFlow Lite terlatih (47 fitur input)
│   ├── vehicles/                             # Gambar transparan kendaraan (Mobil, Motor, Sepeda)
│   └── images/                               # Logo aplikasi, ikon splash screen, dan aset visual lainnya
│
├── patches/                                  # Layer Patch Pihak Ketiga
│   └── react-native@0.86.3.patch             # Perbaikan properti global Fusebox DevTools pada React Native 0.86.3
│
├── app.json                                  # Konfigurasi Expo, izin lokasi background Android/iOS, & plugin native
├── metro.config.js                           # Konfigurasi bundler Metro (dukungan aset .tflite & resolusi symlink pnpm)
└── package.json                              # Daftar dependensi, skrip build, dan konfigurasi pnpm patch
```

---

## 2. Hubungan Antar-Layer (Dependency Direction)

Untuk menjaga kode tetap bersih dan mudah dirawat, arah ketergantungan (*dependency flow*) mengikuti aturan satu arah berikut:

```
┌─────────────────────────────────────────────────────────────┐
│                Layer 1: Screens (`app/*`)                   │
│   Mengatur layout halaman dan menghubungkan Hooks dengan    │
│                  Komponen UI (`components/*`)               │
└──────────────────────────────┬──────────────────────────────┘
                               │ memanggil
                               ▼
┌─────────────────────────────────────────────────────────────┐
│        Layer 2: Contexts (`contexts/*`) & Hooks (`hooks/*`) │
│  Mengelola state reaktif, siklus hidup sensor, dan caching  │
└──────────────┬───────────────────────────────┬──────────────┘
               │ memanggil                     │ memanggil
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│  Layer 3A: Edge AI Engine    │ │  Layer 3B: Services Layer  │
│        (`edge-ai/*`)         │ │      (`services/*`)        │
│ Ekstraksi 47 fitur & TFLite  │ │ REST Client, OfflineQueue, │
│    3-Tier Inference Engine   │ │ HistoryCache, BgTracking   │
└──────────────┬───────────────┘ └─────────────┬──────────────┘
               │ menggunakan                   │ menggunakan
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│         Layer 4: Types (`types/*`) & Tokens (`lib/*`)       │
│        Kontrak tipe data murni tanpa ketergantungan UI      │
└─────────────────────────────────────────────────────────────┘
```
