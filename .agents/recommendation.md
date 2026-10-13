# Rekomendasi Integrasi & Pengembangan Frontend HyperGrid Mobile

Dokumen ini disusun sebagai panduan strategis dan teknis bagi tim pengembang untuk melanjutkan integrasi API backend NestJS, PostGIS, Better-Auth, dan modul Edge AI ke seluruh layar frontend yang saat ini masih menggunakan mock data statis.

---

## 1. Halaman Autentikasi (`app/index.tsx`)

### Kondisi Saat Ini
- Layar login menampilkan ilustrasi dan tombol "Masuk dengan Google" yang masih berupa navigasi dummy langsung ke `/(onboarding)`.
- Tombol Settings di pojok kanan bawah belum memiliki handler fungsional.

### Rekomendasi Integrasi
1. **Pemanfaatan Hook `useAuth`**:
   - Manfaatkan hook `@/hooks/use-auth.ts` untuk menangani sesi petugas.
   - Tambahkan form input modal atau dialog (Email & Password) untuk `authService.signIn({ email, password })`.
   - Simpan Bearer Token secara terenkripsi menggunakan `expo-secure-store` (telah disediakan modul `tokenStorage`).
2. **Auto-Redirect pada Sesi Aktif**:
   - Pada saat layar `app/index.tsx` dibuka, lakukan verifikasi sesi otomatis melalui `refreshSession()`. Jika `user` ditemukan dan token valid, arahkan pengguna langsung ke `/(tabs)`.
3. **Konfigurasi Lingkungan Server**:
   - Manfaatkan tombol Settings di kanan bawah untuk menampilkan modal pengaturan Base URL runtime (`setRuntimeApiBaseUrl`). Hal ini sangat mempermudah tim QA/developer saat beralih antara IP LAN lokal, emulator, dan server staging/production tanpa harus rebuild APK/IPA.

---

## 2. Layar Live Ride / Drive Mode (`app/ride.tsx` & `components/ride/*`)

### Kondisi Saat Ini
- Angka kecepatan, vibration, shock level, dan koordinat kendaraan masih berupa konstanta dummy di `components/ride/mock-data.ts`.
- Belum ada pembacaan sensor fisik perangkat dan belum ada sistem peringatan dini (early warning).

### Rekomendasi Integrasi
1. **Integrasi Edge AI Real-Time**:
   - Gunakan modul `@/edge-ai` dan hook `@/hooks/use-edge-ai.ts`.
   - Hubungkan listener akselerometer (`expo-sensors`) ke `defaultEdgeDetector.infer(frame)`.
   - Perbarui gauge shock level (`components/ride/shock-gauge.tsx`) berdasarkan pergerakan nilai aktual `zAccelPeak`.
2. **Driver Early Warning (Peringatan Dini Lubang Jalan)**:
   - Pasang interval geofencing (setiap 2–3 detik) yang memanggil `clustersService.checkNearby(lat, lon, 25)` dari PostGIS.
   - Jika endpoint mengembalikan klaster lubang dalam radius dekat (< 20 meter):
     - Picu haptic feedback menggunakan `expo-haptics`.
     - Tampilkan HUD visual alert atau ubah status badge menjadi `"PERINGATAN: LUBANG 15M DI DEPAN"`.
3. **Mekanisme Offline-First Ingestion**:
   - Saat kendaraan melaju di area tanpa sinyal seluler, gunakan `offlineQueue.enqueue(dto)`.
   - Ketika perjalanan selesai (tombol "Stop Drive" ditekan di `DriveActions`) atau saat konektivitas kembali pulih, panggil `offlineQueue.flush()` untuk mengunggah seluruh batch telemetri sekaligus via `POST /api/detections/batch`.

---

## 3. Peta Beranda Utama (`app/(tabs)/index.tsx` & `components/main/main-map.tsx`)

### Kondisi Saat Ini
- Titik kerusakan jalan di peta masih menggunakan `DUMMY_DAMAGE_POINTS` dari `components/map/map-data.ts`.

### Rekomendasi Integrasi
1. **Query Viewport Spasial PostGIS**:
   - Gunakan hook `@/hooks/use-pothole-clusters.ts`.
   - Dengarkan event pergeseran kamera peta (`onRegionChangeComplete` pada `react-native-maps`).
   - Ekstrak batas koordinat `minLat`, `minLon`, `maxLat`, `maxLon`, lalu lakukan pemanggilan ke `clustersService.getClusters(bounds)`.
2. **Sinkronisasi Layer Marker Kerusakan**:
   - Petakan array `PotholeCluster[]` dari PostGIS ke format marker peta:
     - Posisi: `latitude: cluster.center_latitude`, `longitude: cluster.center_longitude`.
     - Tingkat keparahan (`cluster.severity`): `'high'` (#B3261E), `'medium'` (#F59E0B), `'low'` (#FFFF00).
     - Jumlah laporan: `cluster.detection_count`.
     - Rata-rata confidence AI: `cluster.confidence_avg`.

---

## 4. Halaman Profil Petugas (`app/(tabs)/profile.tsx` & `components/profile/*`)

### Kondisi Saat Ini
- Data profil petugas (nama, email, ID) masih statis dari `components/profile/mock-data.ts`.
- Tombol logout di `components/profile/logout-button.tsx` belum menghapus sesi.

### Rekomendasi Integrasi
1. **Menampilkan Profil Nyata**:
   - Ambil data nama dan email dari `useAuth().user`.
   - Format tanggal pendaftaran dari `user.createdAt`.
2. **Aksi Logout Sempurna**:
   - Hubungkan tombol logout ke `authService.signOut()`.
   - Modul akan secara otomatis menghapus token di `expo-secure-store`, membersihkan cache sesi, dan mengarahkan pengguna kembali ke layar `app/index.tsx`.

---

## 5. Rekomendasi State Management & Cache Query

Untuk menyamakan arsitektur dengan frontend web Next.js (`apps/app`):
- Direkomendasikan memasang `@tanstack/react-query` pada aplikasi Expo ini.
- Dengan React Query, data klaster dan log deteksi dapat di-cache secara efisien, memiliki automatic background refetching (misal setiap 10–15 detik), serta sinkronisasi otomatis saat user berpindah antara halaman beranda dan halaman riwayat.
