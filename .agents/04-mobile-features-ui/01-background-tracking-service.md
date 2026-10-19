# 4.1. Layanan Pelacakan Latar Belakang (`background-tracking.ts`)

> **Bagian:** `04-mobile-features-ui` • [⬅️ Sinkronisasi Offline & Caching](../03-backend-api/03-offline-sync-and-caching.md) • [🏠 Indeks Utama](../README.md) • [Engine Peta & Live Drive HUD ➡️](./02-maps-and-navigation-hud.md)

---

## 1. Arsitektur Eksekusi Latar Belakang (Background Execution)

Aplikasi navigasi dan telemetri jalan harus tetap dapat bekerja ketika:
1. Pengemudi mematikan/mengunci layar HP untuk menghemat baterai atau memasukkan HP ke dalam saku/tas saat mengendarai motor/sepeda.
2. Pengemudi berpindah ke aplikasi lain (misalnya membuka Google Maps, Waze, WhatsApp, atau Spotify) saat sedang berkendara.

Untuk memenuhi kebutuhan tersebut, [`services/background-tracking.ts`](../../services/background-tracking.ts) mengintegrasikan **`expo-task-manager` (`57.0.21`)** dan **`expo-location` Foreground Service** dengan dua mode operasi cerdas: **Mode `'driving'`** dan **Mode `'idle'`**.

---

## 2. Perbandingan Mode `'driving'` vs Mode `'idle'`

| Karakteristik | Mode `'driving'` (Sesi Berkendara Aktif) | Mode `'idle'` (Standby / Luar Sesi Berkendara) |
| :--- | :--- | :--- |
| **Kapan Aktif?** | Saat pengguna menekan **Start Drive** dan berada dalam status pemantauan di [`app/ride.tsx`](../../app/ride.tsx). | Saat aplikasi baru dibuka ([`app/_layout.tsx`](../../app/_layout.tsx)) atau setelah pengguna mengakhiri sesi berkendara. |
| **Akurasi GPS (`expo-location`)** | `Location.Accuracy.BestForNavigation` (Akurasi tertinggi satelit GPS) | `Location.Accuracy.Balanced` (Hemat baterai) |
| **Interval Waktu Pembaruan** | Setiap **`1.000 ms` (1 detik)** | Setiap **`10.000 ms` (10 detik)** |
| **Interval Jarak Minimum** | Setiap perpindahan **`2 meter`** | Setiap perpindahan **`15 meter`** |
| **Android Foreground Service** | **Aktif dengan Notifikasi Persisten** (*"HyperGrid Drive Tracking Active"*) agar Android OS tidak membunuh proses sensor & lokasi. | Berjalan ringan di latar belakang tanpa menguras baterai perangkat. |
| **Sinkronisasi Offline Queue** | Auto-flush setiap **30 detik** + saat deteksi baru terjadi. | Auto-flush setiap **30 detik** untuk memastikan antrean tertunda terkirim di latar belakang. |

---

## 3. Cara Kerja Headless Task (`HYPERGRID_BACKGROUND_LOCATION_TASK`)

Task latar belakang didefinisikan di tingkat global (*top-level module scope*) menggunakan `TaskManager.defineTask`:

```
[OS Mengirim Event Lokasi Baru ke HYPERGRID_BACKGROUND_LOCATION_TASK]
                                  │
                                  ▼
         [Ekstrak Koordinat Terakhir (lat, lon, speed, timestamp)]
                                  │
                                  ├──► 1. Simpan ke AsyncStorage
                                  │       (KEY: hypergrid_bg_last_location)
                                  │       Agar saat aplikasi kembali ke foreground,
                                  │       posisi peta langsung sinkron tanpa jeda GPS lock.
                                  │
                                  └──► 2. Panggil triggerPeriodicQueueFlush()
                                          Jika (now - lastFlush >= 30 detik) dan
                                          offlineQueue.size() > 0:
                                          ──► Jalankan offlineQueue.flush() ke Backend!
```

### Sinkronisasi Mulus saat Kembali ke Foreground (`AppState` Listener):
Di [`hooks/use-user-location.ts`](../../hooks/use-user-location.ts) dan [`app/ride.tsx`](../../app/ride.tsx):
- Terdapat listener `AppState.addEventListener('change')`.
- Ketika pengguna membuka kembali layar HyperGrid dari kondisi *background* ke *active (foreground)*, aplikasi langsung membaca koordinat terakhir dari `backgroundTrackingService.getLastBackgroundLocation()` dan menyambung kembali garis rute perjalanan (*polyline*) tanpa terputus.

---

## 4. Konfigurasi Izin Native Android & iOS (`app.json`)

Agar layanan latar belakang diizinkan oleh sistem operasi Android 14+ (SDK 36) dan iOS, konfigurasi berikut telah didaftarkan di [`app.json`](../../app.json):

1. **Android Permissions**:
   - `ACCESS_COARSE_LOCATION` & `ACCESS_FINE_LOCATION`
   - `ACCESS_BACKGROUND_LOCATION`
   - `FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_LOCATION`
   - `WAKE_LOCK`
2. **iOS Background Modes (`infoPlist`)**:
   - `UIBackgroundModes`: `["location", "fetch"]`
   - Deskripsi izin lengkap untuk `NSLocationAlwaysAndWhenInUseUsageDescription`.
3. **Graceful Degradation**:
   - Apabila pengguna hanya memberikan izin lokasi *"While Using the App"* (menolak izin *"Always"*), `startBackgroundTracking()` tetap berjalan menggunakan izin *Foreground Service* tanpa memunculkan error yang menghentikan aplikasi.
