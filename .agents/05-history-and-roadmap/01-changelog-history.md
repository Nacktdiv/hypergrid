# 5.1. Catatan Riwayat Perubahan & Evolusi Arsitektur (`Changelog`)

> **Bagian:** `05-history-and-roadmap` • [⬅️ Design System & Layar](../04-mobile-features-ui/03-design-system-and-screens.md) • [🏠 Indeks Utama](../README.md) • [Status Implementasi & Roadmap ➡️](./02-implementation-status-and-roadmap.md)

---

## Ringkasan Kronologis Pengembangan (Fase 1 s/d Fase 7)

Dokumen ini mencatat seluruh transformasi teknis yang telah dilakukan pada repositori **HyperGrid** dari kondisi prototipe awal hingga menjadi sistem produksi yang utuh.

---

## Fase 1 — Integrasi Penuh REST API Backend & Fondasi Offline-First

Mengubah aplikasi dari prototipe statis yang menggunakan data tiruan (*mock data*) menjadi klien produksi yang terhubung langsung ke backend `hg-server` (NestJS 11 + Prisma 7 + PostGIS):

- **Kontrak Tipe Data (`types/api.ts`)**: Mendefinisikan skema TypeScript untuk `Detection`, `PotholeCluster`, `NearbyClusterWarning`, `User`, dan DTO paginasi.
- **Universal HTTP Client (`services/api/client.ts` & `config.ts`)**:
  - Resolusi Base URL dinamis dengan fitur *Runtime Server URL Override* melalui modal konfigurasi di halaman Login.
  - Injeksi otomatis header `Authorization: Bearer <token>` dan `Origin` serta penanganan sesi kedaluwarsa (`401 Unauthorized`).
- **Layanan Ingesti & Spasial (`detections.service.ts` & `clusters.service.ts`)**:
  - Pengiriman deteksi tunggal (`POST /api/detections`), pengiriman batch (`POST /api/detections/batch`), pengambilan klaster publik (`GET /api/pothole-clusters`), dan peringatan dini radius dekat (`GET /api/pothole-clusters/nearby`).
- **Antrean Offline (`services/api/offline-queue.ts`)**:
  - Menyimpan deteksi ke `AsyncStorage` saat sinyal internet terputus dan melakukan sinkronisasi batch otomatis saat jaringan kembali online.

---

## Fase 2 — Autentikasi `Better-Auth`, Deep-Link Google OAuth, & Onboarding DB Sync

Menyempurnakan siklus hidup akun dan pengalaman login pengguna:

- **Integrasi `Better-Auth` (`contexts/auth-context.tsx` & `auth.service.ts`)**:
  - Mendukung Sign-Up Email/Password, Sign-In Email/Password, dan Sign-Out dengan penyimpanan token terenkripsi di `expo-secure-store`.
- **Google OAuth Native Flow (`app/auth/callback.tsx`)**:
  - Mengimplementasikan alur OAuth mobile menggunakan `expo-web-browser` (`openAuthSessionAsync`) dengan skema deep-link `hypergrid://auth/callback`.
- **Sinkronisasi Status Onboarding di Database (`PATCH /api/auth/onboarding-status`)**:
  - Menambahkan kolom `isOnboarded` pada tabel `user` di PostgreSQL.
  - Memastikan pengguna lama yang login ulang atau berganti perangkat langsung masuk ke halaman utama `/(tabs)` tanpa diminta mengulang onboarding.

---

## Fase 3 — Mesin Edge AI v2 (`hg_model_v2.tflite` - 47 Fitur) & Invarian Orientasi

Mengimplementasikan pipeline Machine Learning *on-device* sesungguhnya untuk menggantikan simulasi deteksi:

- **Dekomposisi Gravitasi 3D Causal EMA (`edge-ai/feature-extractor.ts`)**:
  - Menggunakan filter EMA 3 sumbu ($\alpha = 0.08$) untuk memisahkan percepatan vertikal sejati (`vert_dyn`) dan horizontal (`horiz_dyn`) sehingga akurasi deteksi tidak terpengaruh posisi pemasangan HP.
- **Ekstraksi 47 Fitur Kinematik**:
  - Menghitung 42 fitur statistik (7 sinyal turunan $\times$ 6 metrik: `mean`, `std`, `max`, `min`, `ptp`, `rms`) ditambah 5 fitur rasio spesifik domain (`crest_factor_vert`, `vert_to_horiz_ratio`, `speed_norm_vert_shock`, `vert_zcr`, `is_moving`) dari jendela bergulir 1,5 detik (`20 Hz`).
- **3-Tier Inference Engine (`edge-ai/detector.ts` & `tflite-model.ts`)**:
  - **Tier 1 (`TFLITE_FULL`)**: Eksekusi sinkron JSI C++ `react-native-fast-tflite` pada model `hg_model_v2.tflite` (ambang probabilitas `0.50`).
  - **Tier 2 (`SMART_WINDOW_HEURISTIC`)**: Fallback cerdas berbasis 47 fitur fisik jika modul native belum tersedia.
  - **Tier 3 (`LEGACY_CALIBRATED_HEURISTIC`)**: Fallback untuk jendela sampel pendek.

---

## Fase 4 — Kalibrasi Sensor Multi-Kendaraan, Marker Base64 Dinamis, & Kalibrasi Spidometer

Menyesuaikan perilaku fisik sensor dan tampilan visual dengan jenis kendaraan pengguna:

- **Context Kendaraan Adaptif (`contexts/vehicle-context.tsx`)**:
  - Menyediakan profil fisika khusus untuk **Mobil (`car` — Toyota Avanza 1.5 G)**, **Motor (`motor` — Honda Vario 160 CBS)**, dan **Sepeda (`bicycle` — Polygon Sierra City Bike)**.
  - Mengatur parameter `zShockThreshold` (`1.10 G` / `1.45 G` / `1.15 G`), `idleVibration`, `vibrationFactor`, `speedEmaAlpha`, `speedDisplayFactor`, `minMovingSpeed`, dan `maxSpeedGlitch`.
- **Sinkronisasi Visual Peta & Profil**:
  - Mengganti marker lokasi pengguna di `MainMap` dan `LiveMap` secara real-time menggunakan aset Base64 (`vehicle-assets-base64.ts`) sesuai kendaraan yang dipilih.
  - Mengubah gambar ilustrasi dan spesifikasi kendaraan pada `SelectedVehicleCard` di halaman **Profile**.
- **Penghapusan Peta Dummy & Kalibrasi Kecepatan Berkendara**:
  - Menghapus elemen peta dummy statis di halaman utama dan menggantinya dengan kanvas `MainMap` interaktif penuh.
  - Menerapkan filter EMA kecepatan, *deadband* 0 km/h saat berhenti, fallback jarak Haversine, dan faktor kalibrasi spidometer di `use-user-location.ts` & `ride.tsx`.

---

## Fase 5 — Isolasi Riwayat Per-Akun, Cache `historyStorage` 0ms, & Pemisahan Hak Akses Admin

Menegakkan aturan privasi pengguna mobile dan memisahkan wewenang Admin Dinas PU:

- **Isolasi History Per-User (`userId`)**:
  - Memperbarui backend (`detection.controller.ts` & `detection.service.ts`) serta aplikasi mobile (`detections.service.ts`, `use-detections.ts`, `history.tsx`) agar setiap pengguna di aplikasi native **hanya dapat melihat riwayat deteksi miliknya sendiri**.
  - Mengikat `userId` pengguna aktif secara otomatis pada setiap deteksi baru (`defaultEdgeDetector.setUserId(user.id)`).
- **Peta Utama Publik & Modal Klaster Read-Only (`components/main/main-map.tsx`)**:
  - Memastikan `MainMap` tetap memuat seluruh klaster di database (`fetchClusters({ limit: 500 })`) untuk keselamatan bersama seluruh pengendara.
  - Menghapus tombol mutasi status (*Tandakan Terverifikasi* / *Tandakan Selesai Diperbaiki*) dari modal klaster di aplikasi mobile sehingga murni **Read-Only**.
- **Cache Riwayat Instan (`services/api/history-storage.ts`)**:
  - Menyimpan cache deteksi pengguna di `AsyncStorage` dengan pola *Stale-While-Revalidate* sehingga tab **History** langsung terbuka dalam 0ms.

---

## Fase 6 — Layanan Pelacakan Latar Belakang (`driving` & `idle`) & Perbaikan Build Gradle

Memastikan aplikasi tetap berjalan di latar belakang saat layar terkunci atau berpindah aplikasi:

- **Background Tracking Service (`services/background-tracking.ts`)**:
  - Mengimplementasikan `HYPERGRID_BACKGROUND_LOCATION_TASK` dengan `expo-task-manager@57.0.21` dan Android Foreground Service Notification.
  - Mendukung transisi otomatis antara mode **`'idle'`** (hemat baterai, interval 10 detik / 15 meter, auto-flush antrean offline setiap 30 detik) dan mode **`'driving'`** (akurasi navigasi penuh, interval 1 detik / 2 meter, notifikasi foreground aktif).
- **Perbaikan Konfigurasi Build Android Native**:
  - Menyelaraskan versi `expo-task-manager@57.0.21` dengan skema plugin Gradle Expo SDK 57 (`Publication.version`) serta membersihkan cache transform Gradle dan CMake (`.cxx`) yang korup.

---

## Fase 7 — Penyempurnaan Design System, Swipeable Drawer, & Patch React Native 0.86.3

Memoles kualitas antarmuka pengguna dan stabilitas runtime:

- **Token Desain & Komponen UI (`lib/theme/tokens.ts` & `components/ui/*`)**:
  - Standarisasi komponen `AppButton`, `AppCard`, `SlideCommit`, `StatusBadge`, `MetricPill`, `TopFloatingHeader`, dan `ClusterRadialCard`.
- **Google Maps-Style Swipeable Bottom Drawer (`app/(tabs)/index.tsx`)**:
  - Menambahkan panel kontrol bawah yang dapat digeser naik/turun dengan animasi pegas (`Animated.spring`) di atas peta utama.
- **Layar Ringkasan Perjalanan (`components/ride/trip-completed-view.tsx`)**:
  - Menampilkan statistik akhir perjalanan setelah pengemudi menggeser slider `SlideCommit`.
- **Patch Stabilitas React Native 0.86.3 (`patches/react-native@0.86.3.patch`)**:
  - Memperbaiki crash `TypeError: Cannot redefine property: __FUSEBOX_REACT_DEVTOOLS_DISPATCHER__` dengan menambahkan atribut `configurable: true` pada `setUpReactDevTools.js`.
