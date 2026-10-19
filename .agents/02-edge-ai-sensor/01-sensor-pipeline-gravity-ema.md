# 2.1. Pipeline Sensor 20 Hz & Dekomposisi Gravitasi 3D Causal EMA

> **Bagian:** `02-edge-ai-sensor` • [⬅️ Alur Data End-to-End](../01-architecture/03-end-to-end-data-flow.md) • [🏠 Indeks Utama](../README.md) • [Ekstraksi 47 Fitur ➡️](./02-feature-extraction-47.md)

---

## 1. Tantangan Fisika pada Akuisisi Sensor Smartphone

Saat mendeteksi lubang jalan menggunakan sensor inersia smartphone (`Accelerometer` dan `Gyroscope`), terdapat **3 masalah utama di dunia nyata**:

1. **Orientasi Smartphone Tidak Tetap (Arbitrary Mounting)**:
   - Di mobil, HP bisa dipasang miring di holder kaca depan, tidur di konsol tengah, atau di saku pengemudi.
   - Di motor, HP bisa dipasang di stang dengan kemiringan $30^\circ\text{–}60^\circ$ atau berada di dalam saku jaket.
   - Akibatnya, sumbu $Z$ bawaan sensor HP (`accel.z`) **tidak selalu sejajar dengan arah gravitasi bumi**.
2. **Kontaminasi Gravitasi Bumi ($1.0\text{ G} \approx 9.81\text{ m/s}^2$)**:
   - Sensor Accelerometer selalu membaca percepatan total $\vec{a}_{total} = \vec{a}_{dinamis} + \vec{g}_{bumi}$. Jika HP berputar sedikit saja saat melewati tikungan, komponen gravitasi berpindah antar-sumbu $(X, Y, Z)$ dan dapat mengecoh detektor sederhana.
3. **Beban Re-render Antarmuka React Native**:
   - Frekuensi sampling yang ideal untuk menangkap impuls benturan lubang jalan adalah **20 Hz** (1 sampel setiap `50 ms`). Namun, jika React memanggil `setState()` sebanyak 20 kali per detik, thread UI akan mengalami kemacetan (*frame drop*).

---

## 2. Solusi 1: Akuisisi 20 Hz dengan Throttled UI Rendering (5 Hz)

Di [`app/ride.tsx`](../../app/ride.tsx), pembacaan sensor dan pembaruan tampilan dipisahkan menggunakan `useRef` mutable buffers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│             PEMISAHAN JALUR DATA SENSOR (20 Hz) vs UI (5 Hz)            │
└─────────────────────────────────────────────────────────────────────────┘
[Accelerometer + Gyroscope @ 50ms (20 Hz)]
        │
        ├──► Jalur Cepat (20 Hz - Tanpa Re-render React):
        │    • Update vektor gravitasi 3D EMA (gravityRef.current)
        │    • Hitung percepatan vertikal murni (Z_dyn)
        │    • Masukkan sampel ke Rolling Window Buffer (windowBufferRef)
        │    • Evaluasi Trigger & Jalankan Inferensi Edge AI TFLite
        │
        └──► Jalur Visual HUD (Di-throttle setiap 200ms = 5 Hz):
             • if (now - lastUiUpdateRef.current >= 200)
             • Update state indikator G-Force, ShockGauge, & Vibrasi di layar
```

Dengan arsitektur ini:
- **Mesin Edge AI** tidak kehilangan satu milidetik pun dari puncak benturan (tetap menerima resolusi penuh **20 Hz / 30 sampel per 1,5 detik**).
- **Layar Live Drive HUD** tetap berjalan sangat mulus pada 60 FPS tanpa membebani jembatan JS-ke-UI.

---

## 3. Solusi 2: Dekomposisi Gravitasi 3D Causal EMA ($\alpha = 0.08$)

Untuk membuat deteksi lubang **100% kebal terhadap posisi kemiringan HP (*Orientation-Invariant*)**, [`edge-ai/feature-extractor.ts`](../../edge-ai/feature-extractor.ts) dan [`app/ride.tsx`](../../app/ride.tsx) mengimplementasikan algoritma **Causal 3D Exponential Moving Average (EMA) Low-Pass Gravity Filter** dengan konstanta peluruhan $\alpha = 0.08$ (identik dengan pipeline pelatihan model di Python).

### Langkah Matematis pada Setiap Sampel $t$:

#### Langkah A — Estimasi Vektor Arah Gravitasi ($\vec{g}_t$)
Karena gravitasi bumi bersifat konstan/berubah sangat lambat (frekuensi rendah), sedangkan benturan lubang jalan bersifat impulsif (frekuensi tinggi), filter EMA dengan $\alpha = 0.08$ mengekstrak komponen gravitasi pada ketiga sumbu:

$$g_{x,t} = \alpha \cdot a_{x,t} + (1 - \alpha) \cdot g_{x,t-1}$$
$$g_{y,t} = \alpha \cdot a_{y,t} + (1 - \alpha) \cdot g_{y,t-1}$$
$$g_{z,t} = \alpha \cdot a_{z,t} + (1 - \alpha) \cdot g_{z,t-1}$$

Magnitudo vektor gravitasi saat itu adalah:
$$\|\vec{g}_t\| = \sqrt{g_{x,t}^2 + g_{y,t}^2 + g_{z,t}^2} \approx 1.0\text{ G}$$

Dan vektor satuan arah vertikal bumi ($\hat{g}_t$) di dalam kerangka koordinat HP adalah:
$$\hat{g}_t = \left( \frac{g_{x,t}}{\|\vec{g}_t\|}, \frac{g_{y,t}}{\|\vec{g}_t\|}, \frac{g_{z,t}}{\|\vec{g}_t\|} \right)$$

#### Langkah B — Vektor Percepatan Dinamis Murni ($\vec{d}_t$)
Dengan mengurangkan vektor gravitasi dari bacaan mentah sensor, kita mendapatkan percepatan dinamis murni kendaraan:
$$\vec{d}_t = \vec{a}_t - \vec{g}_t = (a_{x,t} - g_{x,t},\; a_{y,t} - g_{y,t},\; a_{z,t} - g_{z,t})$$

Magnitudo percepatan dinamis total adalah:
$$\text{acc\_mag}_t = \|\vec{d}_t\| = \sqrt{d_{x,t}^2 + d_{y,t}^2 + d_{z,t}^2}$$

#### Langkah C — Proyeksi Guncangan Vertikal (`vert_dyn`) vs Horizontal (`horiz_dyn`)
Menggunakan perkalian titik (*dot product*) antara percepatan dinamis $\vec{d}_t$ dan vektor satuan gravitasi $\hat{g}_t$, sistem memisahkan:

1. **Guncangan Vertikal Sejati (`vert_dyn`)** — Gerakan naik-turun suspensi menghantam lubang jalan:
   $$\text{vert\_dyn}_t = \vec{d}_t \cdot \hat{g}_t = \frac{d_{x,t} g_{x,t} + d_{y,t} g_{y,t} + d_{z,t} g_{z,t}}{\|\vec{g}_t\|}$$

2. **Guncangan Horizontal / Lateral (`horiz_dyn`)** — Gerakan pengereman, akselerasi maju, gaya sentrifugal belokan, atau goyangan tangan:
   $$\text{horiz\_dyn}_t = \sqrt{\max\left(0,\; \|\vec{d}_t\|^2 - \text{vert\_dyn}_t^2\right)}$$

---

## 4. Mekanisme Gatekeeper (Pre-Filter Trigger)

Apakah model TFLite dieksekusi pada setiap ketukan `50 ms` tanpa henti? **Tidak.**
Untuk menghemat baterai dan CPU, HyperGrid menerapkan arsitektur **Two-Stage Gatekeeper + Classifier**:

1. **Tahap 1 — Gatekeeper Cepat (Pre-Filter)**:
   Setiap sampel baru masuk ke dalam *Rolling Window Buffer* berdurasi `1.500 ms` (~30 sampel). Evaluasi model hanya dipicu apabila ketiga syarat fisik berikut terpenuhi:
   - **Syarat Kecepatan**: Kendaraan sedang melaju di atas `minMovingSpeed` profil kendaraan (mis. $\ge 4.0\text{ km/h}$ untuk mobil, $\ge 3.5\text{ km/h}$ untuk motor). Ini otomatis mengabaikan guncangan saat pengemudi baru masuk ke kendaraan atau menutup pintu saat parkir.
   - **Syarat Ambang Kejut Vertikal**: Lonjakan vertikal melampaui ambang pemicu (`zShockThreshold`).
   - **Syarat Cooldown**: Telah melewati jeda minimum `3.000 ms` (3 detik) sejak deteksi lubang terakhir agar satu lubang yang sama tidak tercatat dua kali oleh roda depan dan roda belakang.
2. **Tahap 2 — Klasifikasi Penuh 47-Fitur oleh Model TFLite**:
   Begitu *Gatekeeper* terpicu, seluruh jendela `1.500 ms` (sebelum, saat, dan sesudah benturan) dikirim ke [`extractWindowFeatures()`](../../edge-ai/feature-extractor.ts) dan diklasifikasikan oleh model neural network [`hg_model_v2.tflite`](../../assets/models/hg_model_v2.tflite).
   - Jika ternyata lonjakan tersebut berasal dari pengemudi yang mengetuk layar HP atau pengereman mendadak, rasio `vert_to_horiz_ratio` dan `crest_factor_vert` pada 47 fitur akan membuat model memberikan probabilitas rendah ($P < 0.50$) sehingga **ditolak (bukan lubang)**.
