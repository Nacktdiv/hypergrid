# 3.3. Arsitektur Offline-First (`offlineQueue`) & Cache Instan (`historyStorage`)

> **Bagian:** `03-backend-api` • [⬅️ Deteksi & Klasterisasi PostGIS](./02-detections-and-clustering.md) • [🏠 Indeks Utama](../README.md) • [Lanjut ke Bagian 4: Fitur Mobile & UI ➡️](../04-mobile-features-ui/01-background-tracking-service.md)

---

## 1. Mengapa Arsitektur Offline-First Sangat Penting bagi HyperGrid?

Pengendara sering kali melewati jalan rusak di area dengan sinyal seluler yang lemah, terowongan, atau kawasan luar kota. Jika aplikasi hanya mengandalkan pengiriman HTTP langsung tanpa penyimpanan lokal:
1. Titik lubang jalan yang terdeteksi saat sinyal putus akan hilang selamanya.
2. Halaman **History** akan mengalami layar loading kosong (*blank spinner*) atau gagal dibuka saat pengguna tidak memiliki kuota/sinyal internet.

Untuk mengatasi hal tersebut, HyperGrid mengimplementasikan dua lapisan persistensi lokal di atas `@react-native-async-storage/async-storage`:
1. **`offlineQueue` ([`services/api/offline-queue.ts`](../../services/api/offline-queue.ts))**: Menjamin **Zero Data Loss** untuk pengiriman telemetri ke server.
2. **`historyStorage` ([`services/api/history-storage.ts`](../../services/api/history-storage.ts))**: Menjamin **0ms Instant Load** pada halaman riwayat perjalanan pengguna.

---

## 2. Mekanisme Antrean Deteksi Offline (`services/api/offline-queue.ts`)

```
[Edge AI Mengonfirmasi Lubang Jalan]
                 │
                 ├──► 1. Simpan instan ke Local History Cache (historyStorage)
                 │       (Langsung tampil di tab History tanpa menunggu internet)
                 │
                 └──► 2. Coba kirim POST /api/detections ke Server
                          │
                          ├──► BERHASIL (201 Created)
                          │    • Pemicu flush antrean lama jika masih ada sisa
                          │
                          └──► GAGAL (Offline / Timeout / Server Unreachable)
                               • Masuk ke Offline Queue (AsyncStorage)
                               • Kapasitas hingga 500 item deteksi
```

### Cara Kerja Auto-Flush Batch (`offlineQueue.flush()`):
1. **Penyimpanan Antrean**:
   - Disimpan pada key `hypergrid_offline_detections_queue`.
   - Setiap item menyimpan payload lengkap (`latitude`, `longitude`, `confidence`, `severity`, `accelZ`, `gyroX/Y/Z`, `speed`, `userId`) beserta metadata `queuedAt` dan `retryCount`.
2. **Pengiriman Batch Efisien**:
   - Saat koneksi pulih, `offlineQueue.flush()` tidak mengirim ratusan request satu per satu, melainkan menggabungkannya ke dalam satu panggilan **`POST /api/detections/batch`**.
   - Jika endpoint batch gagal karena masalah ukuran payload, sistem memiliki fallback otomatis untuk mengirim item satu per satu dan hanya menyimpan kembali item yang masih gagal.
3. **Empat Titik Pemicu Auto-Flush**:
   - Saat aplikasi pertama kali dibuka / sesi pengguna pulih.
   - Setiap **30 detik** melalui timer periodik di [`services/background-tracking.ts`](../../services/background-tracking.ts).
   - Setiap kali ada deteksi baru yang berhasil terkirim ke server.
   - Saat pengemudi menyelesaikan perjalanan (*End Trip*) di [`app/ride.tsx`](../../app/ride.tsx) atau membuka tab **History**.

---

## 3. Pola Stale-While-Revalidate pada Riwayat (`services/api/history-storage.ts` & `hooks/use-detections.ts`)

Saat pengguna membuka tab **History** ([`app/(tabs)/history.tsx`](../../app/(tabs)/history.tsx)), hook [`useDetections`](../../hooks/use-detections.ts) menjalankan strategi **Stale-While-Revalidate (SWR)**:

```
[Pengguna Membuka Tab History]
              │
              ├──► Langkah 1 (0 ms - Sinkron dari Disk Lokal):
              │    • Baca historyStorage.getAll() dari AsyncStorage
              │    • Langsung render daftar riwayat, metrik, & peta rute!
              │    • Pengguna TIDAK melihat layar loading kosong.
              │
              └──► Langkah 2 (Paralel di Latar Belakang):
                   • Jalankan offlineQueue.flush() (kirim antrean yang tertunda)
                   • Panggil GET /api/detections?limit=100&userId=<user.id>
                   • Gabungkan & dedikasikan (merge & deduplicate) data server
                     dengan deteksi lokal yang belum tersinkronisasi
                   • Simpan hasil terbaru ke historyStorage & perbarui UI
```

### Logika Deduplikasi Cerdas (`mergeWithRemote`):
Ketika menggabungkan data lokal (`local_*`) dengan data yang baru diunduh dari server PostgreSQL:
- Fungsi `historyStorage.mergeWithRemote(remoteItems)` memeriksa apakah ada item lokal sementara (`id` berawalan `local_`) yang memiliki koordinat (`latitude`, `longitude`) dan waktu deteksi (`createdAt` dalam rentang $\pm 60\text{ detik}$) yang sama dengan data resmi dari server.
- Jika cocok, item sementara `local_*` otomatis digantikan oleh entitas resmi dari database server (sehingga tidak pernah muncul data ganda di layar History).
- Jika item `local_*` memang belum sempat terkirim ke server (karena masih offline), item tersebut **tetap dipertahankan di layar History** sehingga pengguna dapat langsung melihat hasil perjalanannya meskipun tanpa sinyal internet.
