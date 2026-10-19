# 3.2. Endpoint Deteksi, Isolasi Per-User, & Klasterisasi Spasial PostGIS

> **Bagian:** `03-backend-api` • [⬅️ Autentikasi & Onboarding](./01-auth-and-onboarding.md) • [🏠 Indeks Utama](../README.md) • [Sinkronisasi Offline & Caching ➡️](./03-offline-sync-and-caching.md)

---

## 1. Ingesti Deteksi Lubang Jalan (`/api/detections`)

Layanan deteksi diimplementasikan pada [`services/api/detections.service.ts`](../../services/api/detections.service.ts). Setiap kejadian lubang jalan yang terkonfirmasi oleh mesin Edge AI dikirim ke server dengan menyertakan `userId` pengemudi.

### 1.1. Kirim Deteksi Tunggal (`POST /api/detections`)
Dipanggil secara real-time saat pengemudi menghantam lubang dalam sesi *Live Drive*.
- **Request Payload (`CreateDetectionPayload`)**:
  ```json
  {
    "latitude": -7.257500,
    "longitude": 112.752100,
    "confidence": 0.89,
    "severity": "Heavy",
    "gyroX": 0.14,
    "gyroY": -0.08,
    "gyroZ": 0.03,
    "accelX": 0.22,
    "accelY": 0.19,
    "accelZ": 2.45,
    "speed": 38.4,
    "deviceId": "Android-sdk_gphone64_x86_64",
    "userId": "usr_01J..."
  }
  ```
- **Response (`201 Created`)**: Mengembalikan objek `Detection` lengkap beserta `clusterId` hasil pengelompokan PostGIS.

### 1.2. Kirim Deteksi Batch (`POST /api/detections/batch`)
Dipanggil oleh [`offlineQueue.flush()`](../../services/api/offline-queue.ts) untuk mengunggah kumpulan deteksi yang terekam saat tidak ada sinyal internet (maksimal 500 item per batch).
- **Request Payload (`BatchCreateDetectionPayload`)**:
  ```json
  {
    "detections": [
      {
        "latitude": -7.257500,
        "longitude": 112.752100,
        "confidence": 0.89,
        "severity": "Heavy",
        "gyroX": 0.14,
        "gyroY": -0.08,
        "gyroZ": 0.03,
        "accelZ": 2.45,
        "speed": 38.4,
        "userId": "usr_01J..."
      }
    ]
  }
  ```
- **Response (`201 Created`)**: `{ "insertedCount": 1, "affectedClusterIds": ["cls_98a..."] }`.

---

## 2. Isolasi Riwayat Deteksi Per-Akun (`GET /api/detections`)

Sesuai aturan privasi dan pemisahan peran (bukan akun Admin), halaman **History** di aplikasi mobile hanya menampilkan riwayat deteksi milik akun pengguna yang sedang login.

- **Endpoint**: `GET /api/detections`
- **Query Parameters**:
  - `userId` *(Wajib dikirim oleh aplikasi mobile)*: Menyaring baris tabel `detection` di PostgreSQL agar hanya mengembalikan deteksi dengan `user_id = :userId`.
  - `limit` *(default: `50`, maks: `100`)* & `offset` *(default: `0`)*
  - `severity` *(opsional)*: `"Light"` | `"Medium"` | `"Heavy"`
- **Endpoint Alternatif**: `GET /api/detections/user/:userId`
- **Perlindungan Berlapis (Server + Client)**:
  1. **Di Backend (`detection.controller.ts` & `detection.service.ts`)**: Menerima query `@Query('userId')` dan menerapkan klausa `WHERE user_id = $1`.
  2. **Di Mobile (`app/(tabs)/history.tsx`)**: Menerapkan validasi tambahan `if (user?.id && d.userId && d.userId !== user.id) return false` serta menyaring berdasarkan tanggal kalender lokal yang dipilih pengguna.

---

## 3. Algoritma Klasterisasi Spasial PostGIS (`/api/pothole-clusters`)

Ketika backend menerima titik deteksi baru pada koordinat $(\text{lat}, \text{lon})$, server secara otomatis menjalankan algoritma agregasi spasial PostGIS:

```
[Deteksi Baru Masuk: (lat, lon, severity, confidence)]
                         │
                         ▼
   Query Spasial PostGIS: ST_DWithin(centroid, point, 15 meter)
                         │
        ┌────────────────┴────────────────┐
        │                                 │
   [Ditemukan Klaster <= 15m]     [Tidak Ada Klaster <= 15m]
        │                                 │
        ▼                                 ▼
• Tambahkan detectionCount (+1)    • Buat PotholeCluster Baru
• Hitung ulang titik pusat         • Set status = 'active'
  (Running Centroid Average)       • Set detectionCount = 1
• Update avgConfidence             • Set initial priorityScore
• Eskalasi severity jika lebih
  parah (Light -> Medium -> Heavy)
• Jika status sebelumnya 'repaired'
  dan muncul laporan baru -> buka
  kembali menjadi 'active'
```

### 3.1. Mengambil Peta Klaster Publik (`GET /api/pothole-clusters`)
Digunakan oleh [`MainMap`](../../components/main/main-map.tsx) pada halaman utama agar seluruh pengendara dapat melihat sebaran titik kerusakan jalan di seluruh kota.
- **Query Parameters**:
  - `limit`: `500` (memuat seluruh klaster aktif/terverifikasi/diperbaiki di area kota).
  - `status` *(opsional)*: `"active"` | `"verified"` | `"repaired"` | `"false_positive"`
  - `severity` *(opsional)*: `"Light"` | `"Medium"` | `"Heavy"`
  - `minLon`, `minLat`, `maxLon`, `maxLat` *(opsional)*: Filter *Spatial Bounding Box* (`ST_MakeEnvelope`).

### 3.2. Peringatan Dini Radius Terdekat (`GET /api/pothole-clusters/nearby`)
Digunakan oleh layar berkendara [`app/ride.tsx`](../../app/ride.tsx) setiap 2,5 detik untuk mendeteksi bahaya lubang jalan di depan pengemudi.
- **Query Parameters**:
  - `lat` & `lon`: Koordinat GPS pengemudi saat ini.
  - `radius`: Jarak radius peringatan dalam meter (default di `ride.tsx`: **`25 meter`**).
- **Response (`200 OK`)**: Array `NearbyClusterWarning[]` yang diurutkan dari jarak terdekat (`distanceMeters`), hanya mencakup klaster berstatus `active` atau `verified`.

### 3.3. Mutasi Status Klaster — Eksklusif Web Admin (`PATCH /api/pothole-clusters/:id/status`)
- **Penting**: Endpoint ini **hanya digunakan oleh Web Dashboard Admin (Dinas PU)**. Aplikasi mobile tidak memanggil endpoint ini karena modal detail klaster di aplikasi mobile dirancang murni **Read-Only**.
