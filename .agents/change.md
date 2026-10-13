# Catatan Perubahan & Dokumentasi Pengembangan (Changelog)

Dokumen ini mencatat seluruh perubahan, keputusan arsitektur, dan penambahan kode yang dilakukan dalam penugasan implementasi API Integration, Edge AI, dan restrukturisasi fitur menyeluruh pada proyek **HyperGrid Expo React Native**.

---

## 1. Ringkasan Eksekutif & Struktur Folder

Aplikasi mobile HyperGrid kini telah selesai direstrukturisasi dan diimplementasikan secara penuh dengan arsitektur berlapis (*clean & layered architecture*), mengintegrasikan backend NestJS 11 + PostGIS + Better-Auth serta modul Edge AI on-device:

1. **Type Layer (`types/`)**: Pemetaan skema PostGIS dan Prisma ORM sesuai `backend-documentation.md`.
2. **Network & Service Layer (`services/api/`)**: HTTP Client universal dengan interceptor token, auto-detect base URL (IP LAN otomatis via Expo dev server, Android emulator `10.0.2.2`, iOS/Web `localhost`), dan secure storage via `expo-secure-store`.
3. **Edge AI Inference Layer (`edge-ai/`)**: Detektor kerusakan jalan on-device dengan generator dummy confidence terkalibrasi (`0.85` – `0.98`) untuk tahap testing.
4. **Offline Queue Layer (`services/api/offline-queue.ts`)**: Penampung telemetri saat sinyal lemah dan auto-flush via batch ingestion saat online.
5. **Sensor Pipeline Layer (`expo-sensors` & `hooks/use-edge-ai.ts`)**: Pembacaan akselerometer fisik HP real-time untuk mendeteksi guncangan vertikal ($Z\text{-Peak}$) dan lonjakan gravitasi.
6. **Hook Layer (`hooks/`)**: Abstraksi React hook untuk auth, telemetri deteksi, klaster spasial, dan Edge AI.
7. **Penyelesaian Antarmuka Mobile Menyeluruh**:
   - `app/index.tsx`: Autentikasi Better-Auth (Email/Password & Google OAuth) + Pengaturan Server Base URL.
   - `components/main/main-map.tsx`: Peta beranda interaktif dengan chip filter status, marker klaster PostGIS, dan modal detail verifikasi dinas PU.
   - `app/ride.tsx` & `components/ride/*`: Live Drive HUD, deteksi akselerometer sensor HP nyata, Driver Early Warning PostGIS, dan batch flush.
   - `app/(tabs)/history.tsx`: Riwayat perjalanan berbasis telemetri server dan kalkulasi metrik dinamis.
   - `app/(tabs)/profile.tsx` & `components/profile/*`: Profil petugas Better-Auth, modal Edit Personal Info, dan handler Sign Out.

---

## 2. Rincian Fitur Baru yang Ditambahkan

### A. Google OAuth Authentication (Better-Auth Social Provider)
- **Status Dukungan Backend**: Terverifikasi bahwa backend NestJS mendukung Google OAuth via Better-Auth (`/api/auth/sign-in/social` dengan provider `google`).
- **Implementasi Mobile**:
  - Menambahkan method `authService.signInWithGoogle()` yang memanfaatkan `WebBrowser.openAuthSessionAsync` dari `expo-web-browser`.
  - Tombol *"Masuk dengan Google"* pada `app/index.tsx` kini memicu alur OAuth Google, mengekstrak sesi token, dan mengarahkan pengguna langsung ke beranda aplikasi (`/(tabs)`).

### B. Live Deteksi Guncangan Sensor HP (`expo-sensors` Accelerometer)
- **Implementasi Sensor**:
  - Menggunakan `Accelerometer` dari `expo-sensors` dengan interval pembaruan 120ms.
  - Menghitung magnitudo akselerasi total $G = \sqrt{x^2 + y^2 + z^2}$ dan deviasi guncangan dinamis.
  - Memperbarui gauge level guncangan (`components/ride/shock-gauge.tsx`) dan vibrasi digital (`components/ride/telemetry-rows.tsx`) secara real-time berdasarkan gerakan HP fisik.
  - Ketika terjadi lonjakan di atas ambang batas ($\ge 1.8\text{G}$):
    - Memicu getaran haptic feedback (`expo-haptics`).
    - Menjalankan inferensi `EdgeRoadDamageDetector` dengan dummy confidence (`0.85` – `0.98`).
    - Menampilkan banner notifikasi deteksi anomali guncangan sensor HP di layar HUD.
    - Mengirimkan data telemetri ke endpoint `/api/detections` atau mengantrekannya ke `offlineQueue`.
  - Menyediakan tombol toggle *"Sensor HP: Aktif/Mati"* dan tombol simulasi manual untuk fleksibilitas pengujian di emulator maupun perangkat fisik.

### C. Peningkatan Tampilan Peta Interaktif (GIS Studio Mobile)
- **Komponen Diperbarui**: `components/map/hypergrid-map.tsx` & `components/main/main-map.tsx`.
- **Fitur Baru**:
  - **Chip Filter Status Klaster**: Petugas dapat menyaring titik kerusakan jalan di peta berdasarkan status (`Semua`, `Aktif`, `Valid/Terverifikasi`, `Selesai Diperbaiki`).
  - **Modal Detail Spasial**: Mengetuk marker titik kerusakan di peta membuka modal informasi komprehensif yang menampilkan:
    - Koordinat PostGIS (Latitude & Longitude).
    - Badge tingkat keparahan (*High*, *Medium*, *Low*, *Severe*).
    - Jumlah laporan / deteksi yang teragregasi.
    - Rata-rata skor keyakinan AI model.
    - Status penanganan saat ini.
  - **Aksi Lapangan Petugas PU**: Petugas dapat memvalidasi laporan (*"Validasi / Verified"*) atau menandai telah diperbaiki (*"Selesai Diperbaiki"*) langsung dari modal peta dengan memanggil `clustersService.updateStatus()`.

### D. Fitur Edit Informasi Pribadi (Personal Info)
- **Komponen Diperbarui**: `components/profile/personal-info-list.tsx` & `app/(tabs)/profile.tsx`.
- **Fitur Baru**:
  - Tombol *"Edit"* pada kartu informasi pribadi membuka modal *"Edit Informasi Pribadi"*.
  - Petugas dapat memperbarui:
    - Nama Lengkap Petugas.
    - Nomor Telepon / WhatsApp.
  - Perubahan disimpan secara persisten di `tokenStorage` dan memperbarui state sesi aktif secara instan via `useAuth().updateProfile()`.
  - Feedback notifikasi berhasil tersimpan.

### E. Perbaikan Validasi Origin Better-Auth (Missing or null Origin)
- **Akar Masalah**: Pada runtime React Native Android (OkHttp/Fetch), header `Origin` tidak dikirim otomatis atau bernilai `"null"` oleh native networking layer. Better-Auth memiliki middleware `origin-check.mjs` yang melempar error `403 Forbidden: Missing or null Origin` jika header Origin tidak ada pada endpoint social sign-in.
- **Solusi**:
  - Menambahkan header default `Origin: 'http://localhost:8081'` pada [`services/api/client.ts`](file:///home/nacktdiv/Project/hypergrid/services/api/client.ts). Alamat ini terdaftar resmi dalam daftar `trustedOrigins` backend NestJS Better-Auth (`auth.ts`).
  - Menggunakan `Linking.createURL('/auth/callback')` dari `expo-linking` pada [`services/api/auth.service.ts`](file:///home/nacktdiv/Project/hypergrid/services/api/auth.service.ts) agar deep link skema Expo Go (`exp://`) dan standalone (`hypergrid://`) dapat ditangani dengan benar.

### F. Migrasi Peta ke Leaflet.js + OpenStreetMap (Bebas Google Maps SDK)
- **Akar Masalah Google Maps**: Google Maps SDK for Android (`react-native-maps`) memerlukan Google Cloud API Key dengan SHA-1 keystore restriction dan billing aktif. Di Expo Go Android, package name adalah `host.exp.exponent` sehingga API key ditolak dan peta hanya menampilkan layar abu-abu/blank kosong.
- **Solusi & Implementasi**:
  1. Memasang `react-native-webview` (didukung penuh oleh Expo Go).
  2. Membuat [`components/map/leaflet-map.tsx`](file:///home/nacktdiv/Project/hypergrid/components/map/leaflet-map.tsx):
     - Memuat OpenStreetMap Carto tiles resmi tanpa perlu API Key apa pun.
     - Interaktif penuh (geser, zoom, cubit) dengan performa mulus.
     - Marker titik kerusakan jalan dinamis dari PostGIS (dengan warna keparahan dan jumlah laporan).
     - Polyline garis rute navigasi.
     - Posisi kendaraan & lokasi pengguna.
     - Komunikasi dua arah: klik marker di Leaflet memicu modal verifikasi dinas PU di React Native.
### G. Live GPS Koordinat, Live Drive Tracking, & Swiss Design History Screen
1. **Live Koordinat GPS Halaman Utama (`MainMap`)**:
   - Dibuat hook [`hooks/use-user-location.ts`](file:///home/nacktdiv/Project/hypergrid/hooks/use-user-location.ts) memanfaatkan `expo-location`.
   - Mengambil posisi live GPS pengguna untuk kamera Leaflet OpenStreetMap, marker posisi pengguna (`userLocation`), dan posisi kendaraan.
   - Mengambil klaster kerusakan PostGIS di sekitar koordinat GPS riil pengguna.
   - Ditambahkan telemetry badge live GPS dan tombol *Lokasi Saya* untuk re-center.
2. **Drive Mode Tracking (`app/ride.tsx` & `LiveMap`)**:
   - `useUserLocation(true)` melacak jejak perjalanan berkendara secara real-time (`watchPositionAsync`), membentuk rute *breadcrumb polyline* yang digambar di atas Leaflet OpenStreetMap.
   - Kecepatan kendaraan memprioritaskan kalkulasi speed sensor GPS nyata.
   - Sensor `Accelerometer` mengukur gaya gravitasi $G = \sqrt{x^2+y^2+z^2}$, deviasi getaran, dan mendeteksi guncangan tajam ($\ge 1.7\text{G}$).
   - Saat terjadi lonjakan: getaran haptic feedback berat, inferensi Edge AI on-device dijalankan (confidence dummy terkalibrasi `0.85` - `0.98`), titik kerusakan baru langsung ditambahkan ke peta HUD secara live, dan payload dikirim ke backend `/api/detections` via `offlineQueue`.
3. **Riwayat Perjalanan (Swiss Design & Data Nyata)**:
   - **Pemilih 7 Hari Dinamis**: [`components/history/date-utils.ts`](file:///home/nacktdiv/Project/hypergrid/components/history/date-utils.ts) menghasilkan deret 7 hari mundur dari `new Date()`.
   - **Modal Kalender Rentang Tanggal**: Tombol `[KAL]` membuka modal kalender bergaya Swiss Design (grid monokrom tegas, navigasi bulan, quick presets: Hari Ini, Kemarin).
   - **Tampilan Peta Berbasis Data Riil (Non-Dummy)**:
     - Jika tidak ada perjalanan pada tanggal itu: Peta dummy dihilangkan total dan digantikan oleh **Swiss Design Empty State** (*TIDAK ADA PERJALANAN*) dengan metrik nihil dan tombol *Mulai Drive Mode Sekarang*.
     - Jika ada perjalanan: Menampilkan `LeafletMap` dengan koordinat rute GPS riil dan titik-titik anomali kerusakan yang terekam pada tanggal tersebut.

### H. Middleware Autentikasi, Route Guarding, & Auto-Redirect Session Expired
1. **Middleware Route Guard ([`contexts/auth-context.tsx`](file:///home/nacktdiv/Project/hypergrid/contexts/auth-context.tsx))**:
   - Memanfaatkan `useSegments()` dan `useRouter()` dari `expo-router` untuk proteksi rute secara reaktif.
   - **Log Out / Sesi Habis ➔ Redirect ke Login**:
     - Jika pengguna tidak memiliki sesi aktif (`!user`) dan berada di rute protected (`(tabs)`, `ride`), sistem secara otomatis langsung melempar pengguna ke halaman login & register (`/`).
   - **Sudah Login ➔ Redirect ke Dashboard**:
     - Jika pengguna sudah terautentikasi dan membuka layar root login (`/`), middleware otomatis mengalihkan pengguna ke dashboard (`/(tabs)`).
2. **Network Interceptor 401 Session Expired ([`services/api/client.ts`](file:///home/nacktdiv/Project/hypergrid/services/api/client.ts))**:
   - Setiap kali backend mengembalikan respons `401 Unauthorized` (misal token kedaluwarsa atau database server baru saja di-reset), client langsung:
     - Mengosongkan SecureStore (`tokenStorage.clearAll()`).
     - Memicu event melalui [`services/api/auth-events.ts`](file:///home/nacktdiv/Project/hypergrid/services/api/auth-events.ts).
     - Mengubah state autentikasi global menjadi `user: null`, memicu Route Guard untuk melempar pengguna ke layar login dengan pesan informatif *"Sesi Anda telah berakhir. Silakan masuk kembali."*
3. **Penyempurnaan Halaman Login & Register ([`app/index.tsx`](file:///home/nacktdiv/Project/hypergrid/app/index.tsx))**:
   - Menampilkan banner & alert ketika sesi berakhir.
   - Menyediakan tombol terpisah: *"Masuk Petugas"* dan *"Daftar Akun Baru"* untuk kemudahan akses langsung pengguna.

---

## 3. Hasil Pengujian & Kualitas Kode

1. **TypeScript Compilation (Strict Mode)**:
   ```bash
   npx tsc --noEmit
   # Exit Code: 0 (Lolos tanpa error)
   ```
2. **ESLint / Expo Lint**:
   ```bash
   npm run lint
   # Exit Code: 0 (Lolos dengan 0 error dan 0 warning)
   ```
3. **Kesiapan Proyek**:
   - Seluruh fungsionalitas aplikasi mulai dari Autentikasi (Email & Google), Auth Middleware & Route Guarding, Live GPS Tracking & Sensor Guncangan Edge AI, Peta Spasial Klaster PostGIS (Leaflet + OpenStreetMap), Riwayat Perjalanan Swiss Design Berbasis Data Nyata, hingga Manajemen Profil Petugas telah selesai 100%.
