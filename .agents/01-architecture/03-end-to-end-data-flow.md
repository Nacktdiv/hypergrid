# 1.3. Alur Data Sistem dari Awal hingga Akhir (End-to-End Data Flow)

> **Bagian:** `01-architecture` • [⬅️ Struktur Proyek](./02-project-structure.md) • [🏠 Indeks Utama](../README.md) • [Lanjut ke Bagian 2: Edge AI & Sensor ➡️](../02-edge-ai-sensor/01-sensor-pipeline-gravity-ema.md)

---

## Gambaran Siklus Hidup Aplikasi (6 Tahap Utama)

Dokumen ini menjelaskan bagaimana data mengalir di dalam sistem HyperGrid mulai dari saat pengguna membuka aplikasi di smartphone hingga titik kerusakan jalan terpetakan di database spasial PostGIS dan muncul kembali di layar pengguna.

---

## Tahap 1: Bootstrapping, Validasi Sesi, & Gate Onboarding

Saat aplikasi dijalankan, [`app/_layout.tsx`](../../app/_layout.tsx) dan [`contexts/auth-context.tsx`](../../contexts/auth-context.tsx) mengeksekusi langkah-langkah berikut secara berurutan:

```
[Aplikasi Dibuka]
       │
       ▼
[Muat Font & Inisialisasi AuthProvider + VehicleProvider]
       │
       ├──► Jalankan Background Tracking Mode 'idle'
       │    (Pemantauan lokasi hemat baterai & auto-flush antrean offline)
       │
       ▼
[Cek Token Sesi di Expo SecureStore]
       │
       ├─► Tidak Ada Token ──► Redirect ke /(auth) [Layar Login / Register]
       │
       └─► Ada Token ──► Panggil GET /api/auth/get-session
                              │
                              ├─► Sesi Valid & user.isOnboarded === false
                              │   ──► Redirect ke /(onboarding)
                              │       Saat selesai: PATCH /api/auth/onboarding-status { isOnboarded: true }
                              │
                              └─► Sesi Valid & user.isOnboarded === true
                                  ──► Set defaultEdgeDetector.setUserId(user.id)
                                  ──► Redirect langsung ke /(tabs) [Halaman Utama]
```

**Poin Penting:**
- Status onboarding disimpan di **database PostgreSQL backend** (`user.isOnboarded`), bukan hanya di memori lokal HP. Dengan demikian, pengguna yang sudah pernah onboarding tidak akan diminta mengulang onboarding meskipun berganti HP atau menginstal ulang aplikasi.
- Begitu sesi pengguna tervalidasi, ID pengguna (`user.id`) langsung disuntikkan ke dalam mesin detektor Edge AI (`defaultEdgeDetector.setUserId(user.id)`) agar setiap deteksi lubang jalan memiliki kepemilikan akun yang jelas.

---

## Tahap 2: Pemilihan Kendaraan & Sinkronisasi Lintas Layar

Di halaman utama ([`app/(tabs)/index.tsx`](../../app/(tabs)/index.tsx)), pengguna dapat memilih jenis kendaraan yang digunakan melalui komponen [`VehicleSelector`](../../components/main/vehicle-selector.tsx):

1. Pilihan disimpan secara persisten oleh [`VehicleContext`](../../contexts/vehicle-context.tsx) (`car`, `motor`, atau `bicycle`).
2. **Dampak Visual di Peta (`MainMap` & `LiveMap`)**:
   - Ikon penanda lokasi pengguna (*user location marker*) di peta langsung berubah menggunakan gambar Base64 kendaraan yang sesuai (Mobil / Motor / Sepeda).
3. **Dampak Visual di Halaman Profil (`app/(tabs)/profile.tsx`)**:
   - Kartu [`SelectedVehicleCard`](../../components/profile/selected-vehicle-card.tsx) otomatis berubah menampilkan nama model standar (Toyota Avanza 1.5 G / Honda Vario 160 CBS / Polygon Sierra City Bike), gambar ilustrasi kendaraan, dan spesifikasi kalibrasi sensornya.
4. **Dampak Fisika pada Sensor (`app/ride.tsx` & `edge-ai/detector.ts`)**:
   - Ambang batas guncangan vertikal (`zShockThreshold`), kompensasi getaran mesin stasioner (`idleVibration`), dan faktor kehalusan spidometer (`speedEmaAlpha` & `speedDisplayFactor`) otomatis menyesuaikan karakteristik suspensi kendaraan tersebut.

---

## Tahap 3: Pemuatan Peta Klaster Publik (`Start Tab`)

Pada saat halaman utama terbuka:
1. Komponen [`MainMap`](../../components/main/main-map.tsx) memanggil hook [`usePotholeClusters`](../../hooks/use-pothole-clusters.ts) yang menembak endpoint `GET /api/pothole-clusters?limit=500`.
2. **Bersifat Publik Se-Kota**: Query ini sengaja **tidak** difilter berdasarkan `userId` agar setiap pengendara dapat melihat seluruh titik klaster lubang jalan yang telah terdeteksi oleh komunitas pengendara lain maupun yang telah diverifikasi oleh Dinas PU.
3. Ketika pengguna menekan salah satu marker klaster di peta, muncul modal [`ClusterRadialCard`](../../components/main/cluster-radial-card.tsx) yang bersifat **Read-Only** (menampilkan tingkat keparahan, skor prioritas, rata-rata akurasi AI, dan jumlah laporan tanpa tombol ubah status admin).

---

## Tahap 4: Mode Berkendara Aktif (`Live Drive HUD` & Akuisisi 20 Hz)

Ketika pengguna menekan tombol **Start Drive**, aplikasi berpindah ke [`app/ride.tsx`](../../app/ride.tsx):

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     ALUR PEMROSESAN LIVE DRIVE (20 Hz)                     │
└────────────────────────────────────────────────────────────────────────────┘
  [1] Background Service beralih dari mode 'idle' ──► mode 'driving'
      (Android Foreground Service aktif + GPS BestForNavigation)
                                     │
                                     ▼
  [2] Accelerometer & Gyroscope membaca data setiap 50ms (20 Hz)
                                     │
                                     ▼
  [3] Dekomposisi Gravitasi 3D Causal EMA (alpha = 0.08)
      • Menghitung vektor gravitasi dinamis 3 sumbu (gx, gy, gz)
      • Memproyeksikan percepatan ke sumbu vertikal sejati (vert_dyn)
      • Kebal terhadap posisi kemiringan HP di stang / dashboard / saku
                                     │
                                     ▼
  [4] Masuk ke Rolling Window Buffer (Durasi 1.5 Detik = ~30 Sampel)
      • Update tampilan UI HUD di-throttle ke 5 Hz (200ms) agar bebas lag
                                     │
                                     ▼
  [5] Evaluasi Trigger Pre-Filter:
      • Apakah kendaraan melaju? (calibratedSpeed >= minMovingSpeed)
      • Apakah lonjakan kejut melampaui ambang? (Z_dyn >= zShockThreshold)
      • Apakah sudah lewat masa jeda? (Cooldown >= 3.000 ms)
```

---

## Tahap 5: Inferensi Edge AI 47-Fitur & Pengiriman ke Server / Offline Queue

Apabila sebuah lonjakan guncangan lolos dari *Pre-Filter Trigger* pada Tahap 4:

1. **Ekstraksi 47 Fitur ([`edge-ai/feature-extractor.ts`](../../edge-ai/feature-extractor.ts))**:
   - Seluruh 30 sampel dalam jendela 1,5 detik diekstrak menjadi `Float32Array(47)` yang terdiri dari 42 metrik statistik (`mean`, `std`, `max`, `min`, `ptp`, `rms` untuk 7 sinyal turunan) dan 5 rasio spesifik domain (`crest_factor_vert`, `vert_to_horiz_ratio`, `speed_norm_vert_shock`, `vert_zcr`, `is_moving`).
2. **Inferensi 3-Tier ([`edge-ai/detector.ts`](../../edge-ai/detector.ts))**:
   - **Tier 1 (`hg_model_v2.tflite`)**: Mengeksekusi model neural network C++ via JSI. Jika skor probabilitas $P \ge 0.50$, titik tersebut sah diklasifikasikan sebagai lubang jalan (*Pothole*).
   - **Tier 2 & 3 (Fallback)**: Jika modul native tidak tersedia, sistem menggunakan *Smart Window Heuristic* berbasis 47 fitur fisik yang sama.
3. **Klasifikasi Keparahan & Feedback Instan**:
   - Ditentukan tingkat keparahan (`Light`, `Medium`, atau `Heavy`).
   - Smartphone memberikan getaran Haptic, menampilkan banner peringatan merah di HUD, dan menambahkan titik baru di peta `LiveMap`.
4. **Penyimpanan Lokal & Ingesti Backend**:
   - Deteksi langsung disimpan ke `historyStorage` lokal (agar langsung terlihat di tab History dalam 0ms).
   - Dikirim ke server melalui `POST /api/detections` beserta `userId` pengguna aktif.
   - Jika tidak ada koneksi internet, deteksi masuk ke `offlineQueue` dan otomatis dikirim secara *batch* (`POST /api/detections/batch`) saat koneksi pulih.
5. **Agregasi Spasial PostGIS di Server**:
   - Server mencari apakah ada `PotholeCluster` dalam radius **15 meter** (`ST_DWithin`).
   - Jika ada, laporan digabungkan ke klaster tersebut dan `priorityScore` diperbarui. Jika belum ada, server membuat klaster baru.

---

## Tahap 6: Riwayat Perjalanan Pribadi (`History Tab`)

Ketika pengguna membuka tab **History** ([`app/(tabs)/history.tsx`](../../app/(tabs)/history.tsx)):

1. **Pemuatan Instan 0ms (*Stale-While-Revalidate*)**:
   - Hook [`useDetections`](../../hooks/use-detections.ts) langsung memuat cache deteksi milik pengguna dari [`historyStorage`](../../services/api/history-storage.ts) di `AsyncStorage`.
2. **Sinkronisasi Terisolasi Per-Akun**:
   - Di latar belakang, aplikasi memanggil `GET /api/detections?limit=100&userId=<user.id>`.
   - Baik di sisi server maupun di sisi klien diterapkan filter ketat sehingga pengguna **hanya dapat melihat riwayat deteksi dari akunnya sendiri**.
3. **Filter Kalender Zona Waktu Lokal**:
   - Pengguna memilih hari melalui [`DaySelector`](../../components/history/day-selector.tsx) (bar 7 hari terakhir atau modal kalender bulanan).
   - Timestamp UTC dikonversi ke tanggal lokal (`YYYY-MM-DD`) melalui [`date-utils.ts`](../../components/history/date-utils.ts), lalu divisualisasikan menjadi metrik harian (`MetricsSummary`), peta jejak perjalanan (`RouteMapPreview`), dan daftar log deteksi (`HistoryItemCard`).
