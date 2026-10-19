# 5.2. Matriks Status Implementasi & Peta Jalan Pengembangan (`Roadmap`)

> **Bagian:** `05-history-and-roadmap` • [⬅️ Riwayat Perubahan (Changelog)](./01-changelog-history.md) • [🏠 Indeks Utama](../README.md)

---

## 1. Matriks Status Implementasi Saat Ini (100% Selesai)

Seluruh kebutuhan fungsional, arsitektur AI, kalibrasi sensor kendaraan, pemisahan hak akses pengguna vs admin, hingga eksekusi latar belakang telah **100% terimplementasi dan terverifikasi** di dalam codebase saat ini:

| No | Domain Fitur | Spesifikasi yang Diterapkan | Lokasi Implementasi Kunci | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Autentikasi & Sesi** | Login/Register Email, Google OAuth Deep-Link (`hypergrid://auth/callback`), Bearer Token `SecureStore`, & Runtime Server URL Config | [`contexts/auth-context.tsx`](../../contexts/auth-context.tsx), [`services/api/auth.service.ts`](../../services/api/auth.service.ts) | ✅ **100% Aktif** |
| **2** | **Onboarding DB Sync** | Status `isOnboarded` tersimpan permanen di PostgreSQL via `PATCH /api/auth/onboarding-status` | [`contexts/auth-context.tsx`](../../contexts/auth-context.tsx), [`app/(onboarding)/index.tsx`](../../app/(onboarding)/index.tsx) | ✅ **100% Aktif** |
| **3** | **Edge AI TFLite 47-Fitur** | Model `hg_model_v2.tflite` (`[1, 47]` input), 3D Causal EMA Gravity Removal ($\alpha = 0.08$), & 3-Tier Fallback Engine | [`edge-ai/feature-extractor.ts`](../../edge-ai/feature-extractor.ts), [`edge-ai/detector.ts`](../../edge-ai/detector.ts), [`edge-ai/tflite-model.ts`](../../edge-ai/tflite-model.ts) | ✅ **100% Aktif** |
| **4** | **Kalibrasi Multi-Kendaraan** | Profil fisika adaptif untuk **Mobil (MPV)**, **Motor (Scooter)**, & **Sepeda**, sinkronisasi kartu Profile, & kalibrasi spidometer EMA | [`contexts/vehicle-context.tsx`](../../contexts/vehicle-context.tsx), [`components/profile/selected-vehicle-card.tsx`](../../components/profile/selected-vehicle-card.tsx) | ✅ **100% Aktif** |
| **5** | **Marker Peta Kendaraan Dinamis** | Ikon posisi pengguna di peta berubah otomatis mengikuti kendaraan terpilih (Mobil / Motor / Sepeda) via aset Base64 | [`components/map/leaflet-map.tsx`](../../components/map/leaflet-map.tsx), [`components/map/vehicle-assets-base64.ts`](../../components/map/vehicle-assets-base64.ts) | ✅ **100% Aktif** |
| **6** | **Peta Klaster Publik & Read-Only Modal** | Menampilkan seluruh klaster database (`limit: 500`) di `MainMap` dengan `ClusterRadialCard` tanpa tombol mutasi status admin | [`components/main/main-map.tsx`](../../components/main/main-map.tsx), [`components/main/cluster-radial-card.tsx`](../../components/main/cluster-radial-card.tsx) | ✅ **100% Aktif** |
| **7** | **Isolasi History Per-User** | Tab `History` hanya menampilkan deteksi milik `user.id` yang sedang login + filter tanggal kalender lokal + cache 0ms (`historyStorage`) | [`app/(tabs)/history.tsx`](../../app/(tabs)/history.tsx), [`hooks/use-detections.ts`](../../hooks/use-detections.ts), [`services/api/history-storage.ts`](../../services/api/history-storage.ts) | ✅ **100% Aktif** |
| **8** | **Background Tracking (`driving` & `idle`)** | Berjalan di latar belakang menggunakan `expo-task-manager` & Android Foreground Service baik saat berkendara maupun kondisi idle | [`services/background-tracking.ts`](../../services/background-tracking.ts), [`app/ride.tsx`](../../app/ride.tsx), [`app/_layout.tsx`](../../app/_layout.tsx) | ✅ **100% Aktif** |
| **9** | **Offline-First Batch Queue** | Antrean lokal di `AsyncStorage` saat sinyal hilang dengan sinkronisasi otomatis ke `POST /api/detections/batch` | [`services/api/offline-queue.ts`](../../services/api/offline-queue.ts) | ✅ **100% Aktif** |

---

## 2. Peta Jalan Pengembangan Lanjutan (Future Production Roadmap)

Untuk pengembangan skala besar berikutnya (implementasi tingkat kota/nasional bersama Dinas Pekerjaan Umum), berikut adalah 5 inisiatif teknis yang direkomendasikan:

### 2.1. Peringatan Suara Aktif (Text-to-Speech Voice Hazard Alert)
- **Deskripsi**: Mengintegrasikan modul `expo-speech` pada mekanisme *Nearby Early Warning* di [`app/ride.tsx`](../../app/ride.tsx).
- **Cara Kerja**: Ketika pengemudi mendekati klaster berstatus `Heavy` dalam jarak $\le 50\text{ meter}$ dengan kecepatan $> 30\text{ km/h}$, aplikasi mengeluarkan peringatan suara otomatis (*"Perhatian, jalan berlubang parah 50 meter di depan"*), sehingga pengendara motor tidak perlu melihat ke layar HP.

### 2.2. Streaming Klaster Real-Time via WebSocket / Server-Sent Events (SSE)
- **Deskripsi**: Menambahkan kanal komunikasi real-time dari `hg-server` ke aplikasi mobile.
- **Cara Kerja**: Saat pengemudi di depan baru saja mendeteksi lubang jalan baru, titik klaster langsung disiarkan (*broadcast*) ke pengemudi lain yang berada di koridor jalan yang sama tanpa harus menunggu siklus *polling* HTTP berikutnya.

### 2.3. Migrasi Storage Telemetri Skala Besar ke SQLite / MMKV
- **Deskripsi**: Saat ini `offlineQueue` dan `historyStorage` menggunakan `AsyncStorage` (optimal hingga 500 entri deteksi per perangkat).
- **Cara Kerja**: Untuk menyimpan rekaman jejak perjalanan penuh (*high-density GPS breadcrumb trails*) selama berbulan-bulan secara lokal, penyimpanan dapat ditingkatkan ke `expo-sqlite` dengan indeks pencarian tanggal dan koordinat spasial lokal.

### 2.4. Over-The-Air (OTA) Model Delivery & Continuous Learning Pipeline
- **Deskripsi**: Memanfaatkan hasil verifikasi Admin Dinas PU di Web Dashboard (`verified` vs `false_positive`) sebagai dataset berlabel baru untuk melatih iterasi model berikutnya (`hg_model_v3.tflite`).
- **Cara Kerja**: Aplikasi mobile memeriksa versi bobot model terbaru dari endpoint server dan mengunduh file `.tflite` baru ke direktori dokumen lokal (`expo-file-system`) tanpa memerlukan pembaruan APK di Play Store.

### 2.5. Pengayaan Konteks Topografi (Barometer & Heading Kemiringan Jalan)
- **Deskripsi**: Memadukan data perubahan ketinggian dari sensor `Barometer` dan arah hadap kompas (`location.coords.heading`) ke dalam payload deteksi.
- **Cara Kerja**: Memungkinkan sistem membedakan apakah kerusakan jalan berada di jalur menanjak/menurun curam, jembatan layang (*flyover*), atau jalur lambat/cepat.
