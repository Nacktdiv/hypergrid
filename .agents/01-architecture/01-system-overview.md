# 1.1. Gambaran Umum Sistem & Ekosistem HyperGrid

> **Bagian:** `01-architecture` • [⬅️ Kembali ke Indeks Utama](../README.md) • [Lanjut ke Struktur Proyek ➡️](./02-project-structure.md)

---

## 1. Visi & Konsep Utama HyperGrid

**HyperGrid** adalah ekosistem pemantauan anomali dan kerusakan jalan (*crowdsourced road damage & pothole intelligence*) secara *real-time* yang menggabungkan:
1. **On-Device Edge AI (TensorFlow Lite)** pada perangkat smartphone pengendara untuk mendeteksi lubang jalan secara instan dari sinyal inersia (Accelerometer, Gyroscope, dan GPS) tanpa harus mengirim *raw sensor stream* ke cloud.
2. **Spatial Aggregation Engine (PostGIS)** pada sisi server yang mengelompokkan laporan deteksi dari berbagai pengendara dalam radius **15 meter** menjadi titik klaster kerusakan jalan terverifikasi beserta skor prioritas perbaikan (*Priority Score*).
3. **Pemisahan Peran (Role Separation)** yang tegas antara **Pengendara Warga (Mobile Native App)** dan **Petugas / Admin Dinas PU (Web GIS Dashboard)**.

---

## 2. Arsitektur Tiga Pilar Ekosistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EKOSISTEM PLATFORM HYPERGRID                         │
├───────────────────────┬───────────────────────────┬─────────────────────────┤
│  1. MOBILE NATIVE APP │   2. BACKEND API SERVER   │  3. WEB ADMIN DASHBOARD │
│     (Repo: hypergrid) │     (Repo: hg-server)     │    (Repo: hg-server)    │
├───────────────────────┼───────────────────────────┼─────────────────────────┤
│ • Expo SDK 57 / RN 86 │ • NestJS 11 + Prisma 7    │ • Next.js 16 App Router │
│ • TFLite Edge AI v2   │ • PostgreSQL + PostGIS    │ • MapLibre GL GIS       │
│ • 20Hz Sensor Engine  │ • Better-Auth Session     │ • TanStack Query v5     │
│ • Background Service  │ • 15m Spatial Clustering  │ • Verifikasi & Tindakan │
│ • Offline-First Queue │ • Priority Scoring Engine │   Perbaikan Dinas PU    │
└───────────┬───────────┴─────────────▲─────────────┴────────────┬────────────┘
            │                         │                          │
            │  POST /api/detections   │   PATCH /api/clusters    │
            │  GET  /api/clusters     │   GET   /api/analytics   │
            └─────────────────────────┴──────────────────────────┘
```

### Pilar 1: Aplikasi Mobile Native (`hypergrid` — Repositori Ini)
Digunakan oleh masyarakat / pengendara sehari-hari (Mobil, Motor, maupun Sepeda).
- Berfungsi sebagai **sensor bergerak cerdas** yang bekerja baik saat layar menyala (*Live Drive HUD*) maupun saat layar terkunci di latar belakang (*Background Tracking Service*).
- Menyajikan **peta sebaran klaster lubang jalan publik** agar seluruh pengguna jalan dapat mewaspadai titik kerusakan di rute mereka.
- Menyajikan **buku catatan riwayat perjalanan pribadi (*Personal History*)** yang terisolasi khusus untuk akun yang sedang login.

### Pilar 2: Backend Server & Spatial Engine (`hg-server/apps/server`)
Bertindak sebagai pusat pemrosesan data spasial dan manajemen sesi.
- Menerima laporan titik deteksi (`single` maupun `batch`) dari aplikasi mobile.
- Menjalankan query geospasial PostGIS (`ST_DWithin` dengan radius 15 meter) untuk menentukan apakah titik deteksi baru merupakan bagian dari lubang jalan yang sudah pernah dilaporkan atau merupakan klaster lubang baru.
- Menghitung ulang titik pusat (*centroid*), rata-rata akurasi AI (`avgConfidence`), tingkat keparahan tertinggi (`severity`), jumlah laporan (`reportCount`), dan skor urgensi perbaikan (`priorityScore`).

### Pilar 3: Web Admin Dashboard (`hg-server/apps/app`)
Digunakan secara eksklusif oleh **Administrator / Dinas Pekerjaan Umum (PU)**.
- Memantau analitik kerusakan jalan tingkat kota/zona.
- Memiliki wewenang penuh untuk mengubah status siklus hidup klaster: dari `Active` $\rightarrow$ `Verified` (setelah survei lapangan) $\rightarrow$ `In Progress` $\rightarrow$ `Repaired` (selesai ditambal/diperbaiki), atau menghapus laporan palsu (`false_positive`).

---

## 3. Matriks Pemisahan Hak Akses (Mobile Driver vs Web Admin)

Salah satu prinsip arsitektur terpenting di HyperGrid adalah **keamanan dan integritas status infrastruktur publik**. Pengguna aplikasi mobile tidak diizinkan memanipulasi status perbaikan jalan milik pemerintah/Dinas PU, dan tidak diizinkan mengintip riwayat perjalanan pribadi pengendara lain.

| Fitur / Kapabilitas Sistem | Aplikasi Mobile Native (Pengendara) | Web Dashboard (Admin Dinas PU) | Implementasi Teknis |
| :--- | :--- | :--- | :--- |
| **Melihat Peta Klaster Lubang Jalan (`MainMap`)** | ✅ **Publik (Seluruh Klaster Database)** | ✅ **Global (Seluruh Klaster Database)** | Mobile memanggil `GET /api/pothole-clusters?limit=500` tanpa filter `userId` agar semua pengendara mendapat manfaat keselamatan bersama. |
| **Melihat Detail Klaster Lubang Jalan** | 🔒 **Read-Only (Hanya Baca)** | ✏️ **Full Mutasi (Edit Status & Hapus)** | Komponen `MainMap` di mobile hanya menampilkan `ClusterRadialCard` informatif tanpa tombol *Verify* atau *Mark Repaired*. |
| **Merekam & Mengirim Deteksi Baru** | ✅ **Aktif (Otomatis Mengikat `userId`)** | ❌ **Tidak Digunakan** | `detector.ts` dan `ride.tsx` menyertakan `userId` dari sesi `AuthContext` pada setiap payload `POST /api/detections`. |
| **Melihat Riwayat Deteksi (`History Tab`)** | 🔒 **Terisolasi Per Akun (`userId`) & Per Hari** | ✅ **Global Audit Log** | Mobile mengirim `GET /api/detections?userId=<user.id>` dan menerapkan filter tanggal lokal pada `app/(tabs)/history.tsx`. |
| **Mengubah Status Klaster (`Verified` / `Repaired`)** | ❌ **Dilarang / Dihapus dari UI** | ✅ **Eksklusif Admin** | Hanya Admin di Web Dashboard yang dapat memanggil `PATCH /api/pothole-clusters/:id`. |

---

## 4. Stack Teknologi Inti (Mobile Native)

| Lapisan | Teknologi & Versi | Peran dalam Sistem |
| :--- | :--- | :--- |
| **Framework & Runtime** | Expo SDK 57, React Native `0.86.3` (New Architecture), React `19.2.0` | Fondasi aplikasi lintas platform dengan dukungan JSI C++ berkinerja tinggi. |
| **Routing & Navigasi** | `expo-router` v55 (File-based Routing) | Manajemen navigasi deklaratif, Route Guard autentikasi, dan penanganan Deep-Link OAuth. |
| **On-Device Machine Learning** | `react-native-fast-tflite` (`hg_model_v2.tflite`) | Eksekusi model neural network TensorFlow Lite secara sinkron melalui JSI C++ tanpa bottleneck bridge. |
| **Sensor & Geospasial** | `expo-sensors` (Accelerometer & Gyroscope), `expo-location` | Akuisisi telemetri inersia 20 Hz (`50ms`) dan pelacakan kecepatan/koordinat GPS presisi tinggi. |
| **Background Execution** | `expo-task-manager` (`57.0.21`) + Android Foreground Service | Menjaga pemantauan sensor dan lokasi tetap berjalan saat aplikasi diminimalkan atau layar mati. |
| **Peta Interaktif** | Leaflet.js + OpenStreetMap Carto via `react-native-webview` | Rendering peta vektor/raster bebas biaya kuota dengan marker kendaraan Base64 kustom dan polyline rute. |
| **Penyimpanan Lokal** | `expo-secure-store` & `@react-native-async-storage/async-storage` | Enkripsi token sesi (`SecureStore`), antrean deteksi offline (`offlineQueue`), dan cache riwayat 0ms (`historyStorage`). |
| **Styling & Design System** | NativeWind v4 (Tailwind CSS) + Custom Design Tokens (`lib/theme/tokens.ts`) | Antarmuka pengguna *Dark Tactical* yang konsisten, responsif, dan ergonomis saat berkendara. |
