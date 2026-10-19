# 4.2. Engine Peta Spasial, Marker Kendaraan Dinamis, & Live Drive HUD

> **Bagian:** `04-mobile-features-ui` • [⬅️ Background Tracking Service](./01-background-tracking-service.md) • [🏠 Indeks Utama](../README.md) • [Design System & Arsitektur Layar ➡️](./03-design-system-and-screens.md)

---

## 1. Engine Peta Interaktif (`components/map/leaflet-map.tsx`)

HyperGrid menggunakan engine peta interaktif berbasis **Leaflet.js + CartoDB Dark/Voyager Tiles** yang dijalankan di dalam `react-native-webview` ([`components/map/leaflet-map.tsx`](../../components/map/leaflet-map.tsx)).

### Keunggulan Arsitektur Peta HyperGrid:
1. **Bebas Kuota & Biaya API Key**: Berfungsi 100% tanpa bergantung pada tagihan Google Maps SDK native, sekaligus mendukung gaya visual *Dark Tactical* yang menyatu dengan tema aplikasi.
2. **Komunikasi Dua Arah Tanpa Reload**:
   - Perubahan koordinat GPS pengemudi, penambahan titik lubang jalan baru, perubahan filter status klaster, dan pergantian ikon kendaraan dikirim melalui `webViewRef.current.injectJavaScript(...)` secara *in-place* tanpa memuat ulang halaman HTML peta.
   - Ketika pengguna mengetuk marker klaster di peta, Leaflet mengirim pesan `window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'POINT_PRESS', id }))` kembali ke React Native untuk membuka modal detail klaster.

---

## 2. Marker Lokasi Kendaraan Dinamis (`vehicle-assets-base64.ts`)

Sesuai dengan pilihan kendaraan aktif di [`VehicleContext`](../../contexts/vehicle-context.tsx), marker posisi pengguna di peta (`MainMap` maupun `LiveMap`) berubah secara dinamis:

- File [`components/map/vehicle-assets-base64.ts`](../../components/map/vehicle-assets-base64.ts) menyimpan representasi gambar Base64 untuk **Mobil (`car`)**, **Motor (`motor`)**, dan **Sepeda (`bicycle`)**.
- Ketika pengguna mengganti jenis kendaraan di halaman utama:
  1. Properti `vehicleType` pada `LeafletMap` diperbarui.
  2. Fungsi JavaScript internal peta `window.updateVehicleIcon(vehicleType)` langsung mengganti ilustrasi kendaraan dan lencana ikon (🚗 / 🏍️ / 🚲) di atas cincin radar lokasi pengguna secara instan tanpa kedipan (*flicker-free*).

---

## 3. Peta Utama Publik & Modal Read-Only (`components/main/main-map.tsx`)

Pada tab **Start** ([`app/(tabs)/index.tsx`](../../app/(tabs)/index.tsx)), komponen [`MainMap`](../../components/main/main-map.tsx) menyediakan fitur pemetaan tingkat kota:

1. **Menampilkan Seluruh Klaster Database**:
   - Memuat hingga 500 klaster lubang jalan dari server (`fetchClusters({ limit: 500 })`) agar pengemudi dapat melihat kondisi seluruh jalan di kotanya.
2. **Filter Status Interaktif**:
   - Pengguna dapat menyaring tampilan marker berdasarkan status: **All**, **Active** (Merah/Oranye), **Verified** (Biru), atau **Repaired** (Hijau).
3. **Kartu Detail Klaster Read-Only (`ClusterRadialCard`)**:
   - Saat sebuah marker klaster ditekan, muncul modal bawah yang menampilkan [`ClusterRadialCard`](../../components/main/cluster-radial-card.tsx):
     - Grafik cincin radial untuk **AI Confidence** dan **Priority Score**.
     - Jumlah laporan komunitas (`detectionCount`), tingkat keparahan (`Heavy`, `Medium`, `Light`), koordinat GPS, serta waktu pertama dan terakhir kali terdeteksi.
   - **Tanpa Tombol Mutasi Admin**: Pengguna aplikasi mobile tidak dapat mengubah status klaster menjadi *Verified* atau *Repaired* karena wewenang tersebut dikhususkan bagi Admin Dinas PU di Web Dashboard.

---

## 4. Kokpit Berkendara Langsung (`app/ride.tsx` & `components/ride/*`)

Layar **Live Drive HUD** dirancang khusus untuk visibilitas tinggi saat berkendara:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [TopFloatingBar]  🟢 AI Active • GPS High • 00:14:22     [Center Map]   │
├─────────────────────────────────────────────────────────────────────────┤
│  ⚠️ ROAD HAZARD AHEAD: Heavy Pothole Cluster in 18m (Confidence 92%)    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                              [LiveMap]                                  │
│         • Polyline jejak perjalanan biru elektrik                       │
│         • Marker kendaraan dinamis (Mobil / Motor / Sepeda)             │
│         • Pin titik lubang baru yang terdeteksi selama perjalanan       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ [BottomHud]                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │   42 km/h        │  │    1.04 G        │  │  3 Anomalies          │  │
│  │ Calibrated Speed │  │  Vertical Shock  │  │  Detected This Trip   │  │
│  └──────────────────┘  └──────────────────┘  └───────────────────────┘  │
│  [ShockGauge: ████████░░░░░░░░░░░░░ (Threshold: 1.10G - Family MPV)]    │
│  [SlideCommit: >>>>>> Geser untuk Mengakhiri Perjalanan (End Trip) >>>] │
└─────────────────────────────────────────────────────────────────────────┘
```

### Komponen Kunci pada Live Drive HUD:
1. **Early Warning Hazard Banner**:
   - Melakukan polling ke `GET /api/pothole-clusters/nearby` setiap 2,5 detik dalam radius **25 meter** di depan pengemudi dan memicu getaran peringatan dini jika ada lubang jalan di depan.
2. **Shock Alert Banner**:
   - Muncul ketika ban kendaraan baru saja menghantam lubang jalan dan terkonfirmasi oleh model TFLite `hg_model_v2.tflite`.
3. **Slide-to-End (`SlideCommit`)**:
   - Mencegah penghentian perjalanan secara tidak sengaja akibat sentuhan layar saat jalan berguncang.
4. **Layar Ringkasan Akhir Perjalanan (`TripCompletedView`)**:
   - Ditampilkan setelah pengemudi menggeser slider *End Trip*, merangkum total durasi perjalanan, jumlah titik kerusakan yang berhasil dipetakan, puncak guncangan G-Force, dan rata-rata akurasi AI.
