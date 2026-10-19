# HyperGrid — Pusat Dokumentasi Arsitektur & Sistem (`.agents/`)

Selamat datang di repositori dokumentasi teknis **HyperGrid**. Seluruh dokumentasi di dalam folder `.agents/` ini diorganisasikan secara **hierarkis berdasarkan domain arsitektur** agar mudah dinavigasi, dipelajari secara mendalam dari hulu ke hilir (*end-to-end*), dan dijadikan acuan pengembangan oleh engineer maupun AI Agent.

---

## 🗂️ Peta Hierarki Dokumentasi `.agents/`

```text
.agents/
├── README.md                                      # Indeks Utama & Peta Navigasi Dokumentasi
│
├── 01-architecture/                               # [1] ARSITEKTUR SISTEM & STRUKTUR KODE
│   ├── 01-system-overview.md                      # Ekosistem 3-Pilar (Mobile, Server, Web Admin) & Hak Akses
│   ├── 02-project-structure.md                    # Peta Direktori & Penjelasan Mendalam Setiap File Repo
│   └── 03-end-to-end-data-flow.md                 # Siklus Hidup Data dari Sensor HP hingga Klaster PostGIS
│
├── 02-edge-ai-sensor/                             # [2] MESIN EDGE AI, TFLITE & KALIBRASI FISIKA SENSOR
│   ├── 01-sensor-pipeline-gravity-ema.md          # Akuisisi Sensor 20Hz & 3D Causal EMA Gravity Removal
│   ├── 02-feature-extraction-47.md                # Spesifikasi Matematis 47 Fitur Sinyal (Indeks 0..46)
│   ├── 03-tflite-3tier-engine.md                  # Model hg_model_v2.tflite, 3-Tier Engine & Klasifikasi Severity
│   └── 04-vehicle-calibration-profiles.md         # Kalibrasi Fisika Adaptif (Mobil, Motor, Sepeda) & Spidometer
│
├── 03-backend-api/                                # [3] INTEGRASI BACKEND API, POSTGIS & OFFLINE-FIRST
│   ├── 01-auth-and-onboarding.md                  # Better-Auth, Google OAuth Deep-Link & Sinkronisasi Onboarding DB
│   ├── 02-detections-and-clustering.md            # Endpoint Deteksi, Isolasi Per-User & Klasterisasi PostGIS 15m
│   └── 03-offline-sync-and-caching.md             # Offline Queue Batch Sync & Stale-While-Revalidate History Cache
│
├── 04-mobile-features-ui/                         # [4] FITUR NATIVE MOBILE, BACKGROUND SERVICE & UI/UX
│   ├── 01-background-tracking-service.md          # Headless TaskManager & Foreground Service ('driving' & 'idle')
│   ├── 02-maps-and-navigation-hud.md              # Engine Peta Spasial, Marker Base64 Dinamis & Live Drive HUD
│   └── 03-design-system-and-screens.md            # Token Desain, Komponen UI, Swipeable Drawer & Arsitektur Layar
│
├── 05-history-and-roadmap/                        # [5] EVOLUSI SISTEM, CHANGELOG & PETA JALAN PRODUKSI
│   ├── 01-changelog-history.md                    # Riwayat Perubahan Teknis Lengkap (Fase 1 s/d Fase 7)
│   └── 02-implementation-status-and-roadmap.md    # Matriks Kesiapan Produksi (100%) & Roadmap Pengembangan
│
└── skills/                                        # [6] AGENT SKILLS & STANDAR KODE REACT NATIVE / EXPO
    └── vercel-react-native-skills/                # Aturan optimasi performa, animasi Reanimated, & UI Native
```

---

## 🧭 Panduan Membaca Berdasarkan Kebutuhan

| Tujuan Pembaca | Urutan Dokumen yang Direkomendasikan |
| :--- | :--- |
| **Memahami Gambaran Besar Sistem & Pemisahan Hak Akses User vs Admin** | 1. [`01-architecture/01-system-overview.md`](./01-architecture/01-system-overview.md)<br>2. [`01-architecture/03-end-to-end-data-flow.md`](./01-architecture/03-end-to-end-data-flow.md) |
| **Mempelajari Cara Kerja Deteksi Lubang AI & Kalibrasi Kendaraan** | 1. [`02-edge-ai-sensor/01-sensor-pipeline-gravity-ema.md`](./02-edge-ai-sensor/01-sensor-pipeline-gravity-ema.md)<br>2. [`02-edge-ai-sensor/02-feature-extraction-47.md`](./02-edge-ai-sensor/02-feature-extraction-47.md)<br>3. [`02-edge-ai-sensor/03-tflite-3tier-engine.md`](./02-edge-ai-sensor/03-tflite-3tier-engine.md)<br>4. [`02-edge-ai-sensor/04-vehicle-calibration-profiles.md`](./02-edge-ai-sensor/04-vehicle-calibration-profiles.md) |
| **Memahami Integrasi API Backend, Isolasi History User & Mode Offline** | 1. [`03-backend-api/01-auth-and-onboarding.md`](./03-backend-api/01-auth-and-onboarding.md)<br>2. [`03-backend-api/02-detections-and-clustering.md`](./03-backend-api/02-detections-and-clustering.md)<br>3. [`03-backend-api/03-offline-sync-and-caching.md`](./03-backend-api/03-offline-sync-and-caching.md) |
| **Memahami Background Service, Peta Interaktif & Komponen UI** | 1. [`04-mobile-features-ui/01-background-tracking-service.md`](./04-mobile-features-ui/01-background-tracking-service.md)<br>2. [`04-mobile-features-ui/02-maps-and-navigation-hud.md`](./04-mobile-features-ui/02-maps-and-navigation-hud.md)<br>3. [`04-mobile-features-ui/03-design-system-and-screens.md`](./04-mobile-features-ui/03-design-system-and-screens.md) |
| **Melihat Riwayat Perubahan Repo & Rencana Pengembangan** | 1. [`05-history-and-roadmap/01-changelog-history.md`](./05-history-and-roadmap/01-changelog-history.md)<br>2. [`05-history-and-roadmap/02-implementation-status-and-roadmap.md`](./05-history-and-roadmap/02-implementation-status-and-roadmap.md) |
