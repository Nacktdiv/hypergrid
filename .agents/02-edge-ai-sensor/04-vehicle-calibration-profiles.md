# 2.4. Profil Kalibrasi Fisika Kendaraan & Kecepatan (`vehicle-context.tsx`)

> **Bagian:** `02-edge-ai-sensor` • [⬅️ Mesin Inferensi TFLite 3-Tier](./03-tflite-3tier-engine.md) • [🏠 Indeks Utama](../README.md) • [Lanjut ke Bagian 3: Backend & API ➡️](../03-backend-api/01-auth-and-onboarding.md)

---

## 1. Mengapa Kalibrasi Harus Berbeda untuk Setiap Jenis Kendaraan?

Lubang jalan yang sama dengan kedalaman $5\text{ cm}$ akan menghasilkan respons inersia yang sangat berbeda tergantung pada jenis kendaraan yang melintasinya:

1. **Mobil Keluarga / MPV (`car` — Standar: Toyota Avanza 1.5 G)**:
   - Memiliki bobot $\sim 1.100\text{ kg}$, 4 roda berukuran besar, serta sistem suspensi *MacPherson Strut* / *Coil Spring* dengan peredam kejut (*damper*) yang empuk.
   - Sebagian besar energi benturan lubang diserap oleh suspensi sebelum sampai ke kabin tempat HP berada. Oleh karena itu, ambang batas pemicu kejut vertikal (`zShockThreshold`) harus **lebih peka (`1.10 G`)**.
2. **Sepeda Motor / Skutik (`motor` — Standar: Honda Vario 160 CBS)**:
   - Memiliki roda berdiameter lebih kecil, jarak main (*travel*) suspensi pendek, dan stang yang terhubung langsung ke garpu depan.
   - Selain itu, mesin 1-silinder skutik menghasilkan getaran frekuensi tinggi yang konstan saat stasioner (`idleVibration: 22 m/s²`). Oleh karena itu, ambang batas pemicu kejut harus **lebih tinggi (`1.45 G`)** agar getaran stang normal tidak dianggap sebagai lubang jalan.
3. **Sepeda Perkotaan (`bicycle` — Standar: Polygon Sierra City Bike)**:
   - Tidak memiliki getaran mesin sama sekali (`idleVibration: 0 m/s²`), melaju pada kecepatan lebih rendah, namun memiliki rangka kaku dan ban bertekanan tinggi yang meneruskan guncangan permukaan jalan secara langsung (`zShockThreshold: 1.15 G`).

---

## 2. Tabel Parameter Kalibrasi Fisika per Kendaraan

Seluruh konstanta kalibrasi dikelola secara terpusat di [`contexts/vehicle-context.tsx`](../../contexts/vehicle-context.tsx):

| Parameter (`VehicleSensorCalibration`) | 🚗 Mobil (`car`) | 🛵 Motor (`motor`) | 🚲 Sepeda (`bicycle`) | Penjelasan Fungsi Fisika |
| :--- | :---: | :---: | :---: | :--- |
| **Model Referensi Standar** | Toyota Avanza 1.5 G | Honda Vario 160 CBS | Polygon Sierra City Bike | Standar rata-rata kendaraan populer di Indonesia |
| **`zShockThreshold`** | **`1.10 G`** | **`1.45 G`** | **`1.15 G`** | Ambang batas percepatan dinamis vertikal ($Z_{dyn}$) untuk memicu evaluasi lubang jalan |
| **`idleVibration`** | `8 m/s²` | `22 m/s²` | `0 m/s²` | Getaran dasar mesin saat kendaraan menyala dalam kondisi berhenti (0 km/h) |
| **`vibrationFactor`** | `1.00x` | `1.35x` | `0.85x` | Pengali intensitas getaran permukaan jalan berdasarkan kekakuan suspensi |
| **`speedEmaAlpha`** | `0.20` | `0.35` | `0.40` | Koefisien kehalusan filter EMA kecepatan GPS (mobil memiliki inersia tinggi sehingga perubahan kecepatannya lebih halus) |
| **`speedDisplayFactor`** | `1.03` (+3%) | `1.05` (+5%) | `1.00` (0%) | Faktor kalibrasi tampilan spidometer (menyesuaikan pembacaan *ground speed* GPS dengan spidometer pabrikan kendaraan) |
| **`minMovingSpeed`** | `4.0 km/h` | `3.5 km/h` | `2.5 km/h` | Batas kecepatan minimum(*deadband*) untuk menyatakan kendaraan sedang bergerak dan mengaktifkan pendeteksian lubang |
| **`maxSpeedGlitch`** | `180 km/h` | `140 km/h` | `50 km/h` | Batas atas kecepatan logis untuk membuang lonjakan error sinyal satelit GPS (*multipath glitch*) |

---

## 3. Algoritma Kalibrasi Kecepatan Berkendara (`use-user-location.ts` & `ride.tsx`)

Pembacaan kecepatan mentah dari chip GPS smartphone (`coords.speed`) sering mengalami *jitter* (melompat-lompat $1\text{–}3\text{ km/h}$ saat berhenti di lampu merah) dan sedikit lebih rendah dibandingkan jarum spidometer mobil/motor (karena pabrikan kendaraan menerapkan toleransi *over-read* 3%–5% sesuai regulasi UNECE R39).

HyperGrid menerapkan **4 tahap pemrosesan kecepatan** di [`hooks/use-user-location.ts`](../../hooks/use-user-location.ts) dan [`app/ride.tsx`](../../app/ride.tsx):

1. **Konversi & Fallback Jarak-Waktu (Haversine Fallback)**:
   - Mengonversi `coords.speed` dari $\text{m/s}$ ke $\text{km/h}$ ($\times 3.6$).
   - Jika chip GPS pada perangkat tertentu mengembalikan `coords.speed === null` atau `0` padahal koordinat berpindah secara signifikan, sistem menghitung kecepatan secara otomatis menggunakan rumus jarak **Haversine** dibagi selisih waktu ($\Delta d / \Delta t$).
2. **Penolakan Glitch Satelit (`maxSpeedGlitch` & Akurasi GPS)**:
   - Jika akurasi sinyal GPS buruk (`accuracy > 45 meter`) atau kecepatan melampaui `maxSpeedGlitch` kendaraan (mis. $> 50\text{ km/h}$ pada sepeda), nilai tersebut diabaikan agar tidak merusak rata-rata kecepatan.
3. **Filter Exponential Moving Average (`speedEmaAlpha`)**:
   $$v_{ema, t} = \alpha_{speed} \cdot v_{raw, t} + (1 - \alpha_{speed}) \cdot v_{ema, t-1}$$
   Menghaluskan transisi angka kecepatan di layar HUD.
4. **Zero-Speed Deadband & Faktor Spidometer (`speedDisplayFactor`)**:
   - Jika $v_{ema} < \text{minMovingSpeed}$ (atau $< 2.2\text{ km/h}$), kecepatan langsung dikunci ke **`0 km/h`** (mencegah angka spidometer bergerak sendiri saat berhenti).
   - Saat melaju, kecepatan dikalibrasi dengan `speedDisplayFactor` ($1.03\times$ untuk mobil, $1.05\times$ untuk motor) sehingga angka yang tampil di layar HUD HyperGrid **selaras dengan spidometer fisik kendaraan pengguna**.

---

## 4. Sinkronisasi Visual Kendaraan di Seluruh Aplikasi

Pemilihan kendaraan melalui [`VehicleContext`](../../contexts/vehicle-context.tsx) menyinkronkan tiga bagian antarmuka secara otomatis:

1. **Drawer Halaman Utama (`components/main/vehicle-selector.tsx`)**:
   - Tombol pemilih interaktif dengan indikator aktif berwarna biru elektrik.
2. **Marker Lokasi Pengguna di Peta (`components/map/leaflet-map.tsx` & `vehicle-assets-base64.ts`)**:
   - Marker posisi pengendara di `MainMap` maupun `LiveMap` otomatis berganti ikon visual (Mobil 🚗 / Motor 🏍️ / Sepeda 🚲) lengkap dengan orientasi cincin radar.
3. **Kartu Kendaraan di Halaman Profil (`components/profile/selected-vehicle-card.tsx`)**:
   - Menampilkan ilustrasi gambar resolusi tinggi (`car.png`, `vehicle-motor.png`, atau `vehicle-bicycle.png`), nama model kendaraan, nomor plat/ID perangkat, serta badge status kalibrasi sensor aktif.
