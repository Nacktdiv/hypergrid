# 3.1. Autentikasi (`Better-Auth`), Sesi Token, & Sinkronisasi Onboarding DB

> **Bagian:** `03-backend-api` • [⬅️ Kalibrasi Kendaraan](../02-edge-ai-sensor/04-vehicle-calibration-profiles.md) • [🏠 Indeks Utama](../README.md) • [Deteksi & Klasterisasi PostGIS ➡️](./02-detections-and-clustering.md)

---

## 1. Arsitektur Klien HTTP & Resolusi Base URL Dinamis

Seluruh komunikasi jaringan ke server `hg-server` dikelola oleh [`services/api/config.ts`](../../services/api/config.ts) dan [`services/api/client.ts`](../../services/api/client.ts).

### 1.1. Urutan Prioritas Resolusi Server URL (`getApiBaseUrl`)
Aplikasi mendukung pergantian alamat IP server secara langsung (*runtime override*) tanpa perlu melakukan *rebuild* APK:
1. **Runtime Override User**: Alamat IP/URL yang diatur pengguna melalui tombol ⚙️ *Server Config* di halaman Login (disimpan di `expo-secure-store`).
2. **Environment Variable**: Nilai `EXPO_PUBLIC_API_URL` dari file `.env`.
3. **Auto-Detect LAN IP (Development)**: Mengekstrak IP lokal laptop dari `Constants.expoConfig.hostUri` (port `3000`).
4. **Platform Fallback**: `http://10.0.2.2:3000` untuk Android Emulator atau `http://localhost:3000` untuk iOS Simulator.

### 1.2. Header Otomatis & Penanganan Sesi Kedaluwarsa (`client.ts`)
Setiap request HTTP otomatis menyertakan:
- `Authorization: Bearer <token>`: Diambil dari `tokenStorage.getToken()` (`expo-secure-store`).
- `Origin: <baseUrl>`: Diperlukan oleh middleware keamanan CSRF/CORS milik **Better-Auth** di NestJS.
- **Interceptor `401 Unauthorized`**: Apabila server mengembalikan status `401` pada request yang terautentikasi, `client.ts` otomatis menghapus token yang kedaluwarsa dan memancarkan sinyal `authEvents.emitUnauthorized()` agar `AuthContext` mengarahkan pengguna kembali ke halaman Login secara mulus.

---

## 2. Endpoint Autentikasi (`Better-Auth` + Custom Auth Controller)

Implementasi layanan autentikasi berada di [`services/api/auth.service.ts`](../../services/api/auth.service.ts).

### 2.1. Registrasi Akun Baru (`POST /api/auth/sign-up/email`)
- **Request Body**:
  ```json
  {
    "email": "nadhif@hypergrid.id",
    "password": "PasswordKuat123",
    "name": "Muhammad Nadhif Aryanta"
  }
  ```
- **Perilaku**: Membuat entitas `User` baru di PostgreSQL dengan nilai awal `isOnboarded: false`, menyimpan Bearer Token sesi ke `SecureStore`, dan mengarahkan pengguna baru ke halaman `/(onboarding)`.

### 2.2. Login Email & Password (`POST /api/auth/sign-in/email`)
- **Request Body**:
  ```json
  {
    "email": "nadhif@hypergrid.id",
    "password": "PasswordKuat123"
  }
  ```
- **Perilaku**: Setelah menerima token sesi, aplikasi langsung memanggil `GET /api/auth/get-session` untuk memuat atribut lengkap pengguna (termasuk `isOnboarded` dari database).

### 2.3. Login Google OAuth Deep-Link (`POST /api/auth/sign-in/social`)
- **Alur Eksekusi Mobile**:
  1. Memanggil `POST /api/auth/sign-in/social` dengan `{ "provider": "google", "callbackURL": "hypergrid://auth/callback" }`.
  2. Server mengembalikan `{ "url": "https://accounts.google.com/o/oauth2/..." }`.
  3. Aplikasi membuka sesi browser aman menggunakan `WebBrowser.openAuthSessionAsync(oauthUrl, 'hypergrid://auth/callback')`.
  4. Setelah pengguna memilih akun Google, browser mengarahkan kembali ke skema `hypergrid://auth/callback?token=...`.
  5. Fungsi `extractTokenFromCallbackUrl()` mengekstrak token sesi, menyimpannya ke `SecureStore`, dan memuat profil pengguna dari `/api/auth/get-session`.

### 2.4. Validasi Sesi Aktif (`GET /api/auth/get-session`)
- **Response (`200 OK`)**:
  ```json
  {
    "session": {
      "id": "sess_01J...",
      "userId": "usr_01J...",
      "token": "eyJhbGciOi...",
      "expiresAt": "2026-11-19T00:00:00.000Z"
    },
    "user": {
      "id": "usr_01J...",
      "name": "Muhammad Nadhif Aryanta",
      "email": "nadhif@hypergrid.id",
      "image": null,
      "isOnboarded": true
    }
  }
  ```

---

## 3. Sinkronisasi Status Onboarding Berbasis Database

Agar pengguna lama tidak pernah dipaksa mengulang layar pengenalan (*Onboarding*) saat login kembali atau berganti perangkat, status onboarding disimpan secara permanen di tabel `user` pada database backend:

- **Endpoint**: `PATCH /api/auth/onboarding-status`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "isOnboarded": true
  }
  ```
- **Alur Sinkronisasi Dua Arah di [`contexts/auth-context.tsx`](../../contexts/auth-context.tsx)**:
  1. **Saat Login / Bootstrap**: Jika `session.user.isOnboarded === true` dari database, aplikasi langsung menandai cache lokal `SecureStore` sebagai selesai dan mengarahkan pengguna langsung ke `/(tabs)`.
  2. **Saat Pengguna Baru Menyelesaikan Onboarding**: Ketika tombol *Get Started* ditekan di [`app/(onboarding)/index.tsx`](../../app/(onboarding)/index.tsx), fungsi `completeOnboarding()` memperbarui state lokal secara optimistik dan memanggil `PATCH /api/auth/onboarding-status` ke database.
