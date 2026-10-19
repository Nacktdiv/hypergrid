# 2.2. Spesifikasi Matematis Ekstraksi 47 Fitur Sinyal (`feature-extractor.ts`)

> **Bagian:** `02-edge-ai-sensor` • [⬅️ Pipeline Sensor & Gravitasi EMA](./01-sensor-pipeline-gravity-ema.md) • [🏠 Indeks Utama](../README.md) • [Mesin Inferensi TFLite 3-Tier ➡️](./03-tflite-3tier-engine.md)

---

## 1. Gambaran Umum Vektor Fitur `[1, 47]`

Model TensorFlow Lite [`hg_model_v2.tflite`](../../assets/models/hg_model_v2.tflite) menerima input berupa tensor `Float32Array` berdimensi **`[1, 47]`**.

Seluruh 47 fitur ini diekstrak secara real-time di [`edge-ai/feature-extractor.ts`](../../edge-ai/feature-extractor.ts) dari jendela waktu bergulir (*rolling window*) berdurasi **1.500 ms** (~30 sampel pada frekuensi 20 Hz, dengan syarat minimum 15 sampel).

> ⚠️ **ATURAN KRITIS:** Urutan indeks `0` hingga `46` pada `Float32Array(47)` **wajib dijaga 100% identik** dengan urutan kolom fitur pada skrip pelatihan Python. Mengubah urutan satu fitur saja akan merusak bobot pembacaan neuron pada model `.tflite`.

---

## 2. Tujuh Sinyal Dasar Turunan (Derivatives & Magnitudes)

Dari setiap sampel mentah $(a_x, a_y, a_z, g_x, g_y, g_z, v_{gps})$ di dalam jendela $N$ sampel, sistem terlebih dahulu membentuk **7 deret waktu (time-series) sinyal fisik**:

1. **`vert_dyn`** ($N$ sampel): Percepatan dinamis vertikal murni (sejajar vektor gravitasi EMA, dalam satuan $G$).
2. **`horiz_dyn`** ($N$ sampel): Percepatan dinamis horizontal/lateral (tegak lurus vektor gravitasi EMA, dalam satuan $G$).
3. **`acc_mag`** ($N$ sampel): Magnitudo vektor percepatan dinamis total ($\|\vec{d}_t\|$, dalam satuan $G$).
4. **`gyro_mag`** ($N$ sampel): Magnitudo kecepatan sudut rotasi 3 sumbu dari giroskop:
   $$\text{gyro\_mag}_t = \sqrt{\text{gyro}_{x,t}^2 + \text{gyro}_{y,t}^2 + \text{gyro}_{z,t}^2}$$
5. **`jerk_vert`** ($N$ sampel): Turunan pertama (*Jerk* / laju perubahan mendadak) dari percepatan vertikal:
   $$\text{jerk\_vert}_0 = 0, \quad \text{jerk\_vert}_t = \text{vert\_dyn}_t - \text{vert\_dyn}_{t-1}$$
6. **`gyro_jerk`** ($N$ sampel): Turunan pertama dari magnitudo kecepatan sudut giroskop:
   $$\text{gyro\_jerk}_0 = 0, \quad \text{gyro\_jerk}_t = \text{gyro\_mag}_t - \text{gyro\_mag}_{t-1}$$
7. **`speed_clean`** ($N$ sampel): Kecepatan laju kendaraan dalam satuan **meter per detik ($\text{m/s}$)** yang telah dibersihkan dari nilai negatif atau lonjakan glitch GPS ($0 \le v \le 50\text{ m/s}$).

---

## 3. Bagian A: 42 Fitur Statistik (Indeks `0` s/d `41`)

Untuk masing-masing dari **7 sinyal dasar** di atas, fungsi `computeStats(arr)` menghitung **6 metrik statistik** secara berurutan:

| Offset | Metrik | Rumus Matematis | Makna Fisik pada Deteksi Lubang |
| :---: | :--- | :--- | :--- |
| `+0` | **`mean`** | $\mu = \frac{1}{N}\sum_{i=1}^N x_i$ | Nilai rata-rata dasar sinyal selama 1,5 detik |
| `+1` | **`std`** | $\sigma = \sqrt{\frac{1}{N-1}\sum_{i=1}^N (x_i - \mu)^2}$ | Tingkat fluktuasi/dispersi energi guncangan (menggunakan pembagi sampel $N-1$ seperti `pandas.std(ddof=1)`) |
| `+2` | **`max`** | $\max(x)$ | Puncak positif tertinggi (kompresi suspensi) |
| `+3` | **`min`** | $\min(x)$ | Lembah negatif terdalam (roda jatuh ke dalam cekungan lubang) |
| `+4` | **`ptp`** | $\max(x) - \min(x)$ | *Peak-to-Peak*: Rentang ayunan ekstrem maksimum ke minimum |
| `+5` | **`rms`** | $\sqrt{\frac{1}{N}\sum_{i=1}^N x_i^2}$ | *Root Mean Square*: Total energi getaran efektif di dalam jendela waktu |

### Tabel Pemetaan Indeks `0 .. 41`:

| Grup | Sinyal Dasar | `mean` | `std` | `max` | `min` | `ptp` | `rms` |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | **`vert_dyn`** | `[0]` | `[1]` | `[2]` | `[3]` | `[4]` | `[5]` |
| **2** | **`horiz_dyn`** | `[6]` | `[7]` | `[8]` | `[9]` | `[10]` | `[11]` |
| **3** | **`acc_mag`** | `[12]` | `[13]` | `[14]` | `[15]` | `[16]` | `[17]` |
| **4** | **`gyro_mag`** | `[18]` | `[19]` | `[20]` | `[21]` | `[22]` | `[23]` |
| **5** | **`jerk_vert`** | `[24]` | `[25]` | `[26]` | `[27]` | `[28]` | `[29]` |
| **6** | **`gyro_jerk`** | `[30]` | `[31]` | `[32]` | `[33]` | `[34]` | `[35]` |
| **7** | **`speed_clean`** | `[36]` | `[37]` | `[38]` | `[39]` | `[40]` | `[41]` |

---

## 4. Bagian B: 5 Fitur Rasio & Domain-Specific (Indeks `42` s/d `46`)

Lima fitur terakhir dirancang secara khusus berdasarkan prinsip dinamika struktur kendaraan untuk membedakan **lubang jalan sejati** dari gangguan sehari-hari (*false positives*):

### Indeks `[42]` — `crest_factor_vert` (Faktor Puncak Vertikal)
$$\text{crest\_factor\_vert} = \frac{\max_{i} |\text{vert\_dyn}_i|}{\text{rms}(\text{vert\_dyn}) + 10^{-6}}$$
- **Fungsi Fisik**: Mengukur seberapa "tajam/impulsif" puncak guncangan dibandingkan rata-rata getaran di sekitarnya.
- **Daya Pembeda**: Jalan berbatu/paving kasar memiliki `rms` yang tinggi terus-menerus sehingga *crest factor*-nya rendah. Sebaliknya, menghantam lubang di jalan aspal mulus menghasilkan puncak tajam sesaat dengan *crest factor* yang sangat tinggi.

### Indeks `[43]` — `vert_to_horiz_ratio` (Rasio Dominasi Vertikal terhadap Horizontal)
$$\text{vert\_to\_horiz\_ratio} = \frac{\text{ptp}(\text{vert\_dyn})}{\text{ptp}(\text{horiz\_dyn}) + 10^{-5}}$$
- **Fungsi Fisik**: Membandingkan kekuatan ayunan vertikal terhadap goyangan menyamping/maju-mundur.
- **Daya Pembeda**: Ketika pengemudi mengerem mendadak, berbelok tajam, atau tidak sengaja menyenggol HP di holder, energi tersebar ke arah horizontal (`horiz_dyn` besar $\rightarrow$ rasio kecil). Ketika ban menghantam lubang, gaya kejut didominasi arah vertikal (`vert_dyn` besar $\rightarrow$ rasio tinggi).

### Indeks `[44]` — `speed_norm_vert_shock` (Guncangan Vertikal Ternormalisasi Kecepatan)
$$\text{speed\_norm\_vert\_shock} = \frac{\text{ptp}(\text{vert\_dyn})}{\text{mean}(\text{speed\_clean}) + 1.0}$$
- **Fungsi Fisik**: Menormalisasi amplitudo guncangan terhadap kecepatan kendaraan (dalam $\text{m/s}$). Lubang yang dilewati pada kecepatan rendah menghasilkan guncangan dengan karakteristik berbeda dibandingkan pada kecepatan tinggi.

### Indeks `[45]` — `vert_zcr` (Vertical Zero-Crossing Rate)
$$\text{vert\_zcr} = \frac{1}{N} \sum_{i=1}^{N-1} \mathbb{I}\left( (\text{vert\_dyn}_i \ge 0) \neq (\text{vert\_dyn}_{i-1} \ge 0) \right)$$
- **Fungsi Fisik**: Menghitung seberapa sering sinyal percepatan vertikal melintasi titik nol (berubah tanda dari positif ke negatif dan sebaliknya).
- **Daya Pembeda**: Mencerminkan frekuensi natural osilasi pegas suspensi dan peredam kejut (*shock absorber*) kendaraan sesaat setelah roda keluar dari lubang.

### Indeks `[46]` — `is_moving` (Indikator Biner Kendaraan Bergerak)
$$\text{is\_moving} = \begin{cases} 1.0 & \text{jika } \text{mean}(\text{speed\_clean}) > 1.5\text{ m/s } (5.4\text{ km/h}) \\ 0.0 & \text{selain itu} \end{cases}$$
- **Fungsi Fisik**: Memberikan sinyal tegas kepada jaringan saraf tiruan mengenai apakah guncangan terjadi saat kendaraan benar-benar melaju di jalan raya atau saat kendaraan berhenti di lampu merah/parkiran.
