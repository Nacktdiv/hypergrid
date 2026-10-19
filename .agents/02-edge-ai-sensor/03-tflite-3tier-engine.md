# 2.3. Model TFLite (`hg_model_v2.tflite`) & Arsitektur 3-Tier Inference Engine

> **Bagian:** `02-edge-ai-sensor` • [⬅️ Ekstraksi 47 Fitur](./02-feature-extraction-47.md) • [🏠 Indeks Utama](../README.md) • [Kalibrasi Profil Kendaraan ➡️](./04-vehicle-calibration-profiles.md)

---

## 1. Spesifikasi Binary Model `hg_model_v2.tflite`

File model neural network disimpan di [`assets/models/hg_model_v2.tflite`](../../assets/models/hg_model_v2.tflite) dengan parameter konfigurasi yang didefinisikan di [`edge-ai/model-config.ts`](../../edge-ai/model-config.ts):

| Parameter Konfigurasi | Nilai | Deskripsi Teknis |
| :--- | :--- | :--- |
| **Lokasi File Aset** | `assets/models/hg_model_v2.tflite` | Dibundel langsung ke dalam APK/IPA melalui `metro.config.js` (`assetExts: ['tflite']`) |
| **Runtime Eksekusi** | `react-native-fast-tflite` | Binding C++ JSI (JavaScript Interface) menggunakan *TypedArray* tanpa serialisasi JSON |
| **Dimensi Input Tensor** | `[1, 47]` (`Float32Array`) | 1 baris sampel berisi 47 fitur kinematik dan statistik dari jendela 1,5 detik |
| **Dimensi Output Tensor** | `[1, 1]` (`Float32Array`) | Skor probabilitas kontinu antara `0.0` (Jalan Normal) hingga `1.0` (Lubang Jalan) |
| **Optimal Decision Threshold** | **`0.50`** | Jika probabilitas output $P \ge 0.50$, kejadian diklasifikasikan sebagai **Lubang Jalan Valid** |
| **Durasi Jendela (`windowSizeMs`)** | `1500 ms` | Menyimpan konteks sinyal sebelum benturan, saat puncak benturan, dan osilasi sesudahnya |
| **Frekuensi Sampling (`sampleRateMs`)** | `50 ms` (`20 Hz`) | Menghasilkan $\sim 30$ sampel per jendela observasi 1,5 detik |
| **Minimum Sampel (`minSamples`)** | `15 sampel` | Batas bawah jumlah sampel agar perhitungan standar deviasi dan *Zero-Crossing Rate* akurat |
| **Masa Jeda (`cooldownMs`)** | `3000 ms` | Mencegah satu lubang yang sama dilaporkan berulang kali dalam rentang 3 detik |

---

## 2. Manajemen Siklus Hidup Model (`edge-ai/tflite-model.ts`)

Modul [`edge-ai/tflite-model.ts`](../../edge-ai/tflite-model.ts) menerapkan pola **Singleton Memory Loader**:

1. **Lazy & Preload Initialization**:
   - Memanggil `loadTensorflowModel(require('../assets/models/hg_model_v2.tflite'))` hanya satu kali dan menyimpan instance model di memori native.
   - Jika beberapa komponen memanggil `loadModel()` secara bersamaan saat startup, sistem menggunakan antrean `loadingPromise` tunggal agar tidak terjadi duplikasi alokasi memori C++.
2. **Synchronous JSI Inference (`runInference`)**:
   - Memanggil `model.runSync([features])` langsung di atas objek `Float32Array(47)`.
   - Waktu eksekusi inferensi di perangkat Android rata-rata hanya **$< 1.5\text{ milidetik}$**, sehingga sama sekali tidak menghambat pembacaan sensor berikutnya.
3. **Graceful Mock Fallback (`edge-ai/fast-tflite-mock.ts`)**:
   - Apabila aplikasi dijalankan di lingkungan yang belum memiliki binary native `react-native-fast-tflite` (misalnya Expo Go standar), resolver di [`metro.config.js`](../../metro.config.js) otomatis mengarahkan import ke [`edge-ai/fast-tflite-mock.ts`](../../edge-ai/fast-tflite-mock.ts) dan mesin detektor otomatis beralih ke **Tier 2 (Smart Window Heuristic)** tanpa mengalami *crash*.

---

## 3. Arsitektur 3-Tier Inference Engine (`edge-ai/detector.ts`)

Kelas `EdgePotholeDetector` di [`edge-ai/detector.ts`](../../edge-ai/detector.ts) dirancang dengan prinsip **High-Availability Fault Tolerance** melalui 3 tingkatan (Tier) evaluasi:

```
                   [Jendela Sensor Terpicu (1.5 Detik)]
                                    │
                                    ▼
                    Apakah jumlah sampel >= 15 sampel?
                     ├── TIDAK ──► [TIER 3: Mode C - Legacy Calibrated Peak]
                     │
                     └── YA
                          │
                          ▼
                  Ekstrak 47 Fitur (Float32Array[47])
                          │
                          ▼
             Apakah Native Model hg_model_v2.tflite Siap?
              ├── YA ────► [TIER 1: Mode A - Full TFLite Neural Network]
              │             • Eksekusi model.runSync([features])
              │             • Ambil probabilitas P dari output tensor [0][0]
              │
              └── TIDAK ─► [TIER 2: Mode B - Smart Window 47-Feature Heuristic]
                            • Evaluasi rumus komposit berbasis Crest Factor,
                              Vert-to-Horiz Ratio, Jerk Vert, & ZCR
```

### Detail Masing-Masing Tier:

1. **Tier 1 — Mode A (`TFLITE_FULL` - Mode Produksi Utama)**:
   - Menggunakan bobot jaringan saraf tiruan dari `hg_model_v2.tflite`.
   - Memvalidasi apakah probabilitas output $P \ge 0.50$.

2. **Tier 2 — Mode B (`SMART_WINDOW_HEURISTIC` - Fallback Berbasis 47 Fitur)**:
   - Jika binary TFLite gagal dimuat, sistem **tetap menggunakan vektor 47 fitur** yang sama untuk menghitung probabilitas heuristik cerdas:
     - Memeriksa rasio kejut vertikal terhadap ambang kendaraan ($\text{shockRatio} = \frac{\text{ptp}(\text{vert\_dyn})}{\text{zShockThreshold}}$).
     - Memberikan bobot positif jika $\text{crest\_factor\_vert} > 2.2$ (impuls tajam) dan $\text{vert\_to\_horiz\_ratio} > 1.2$ (dominan vertikal).
     - Memberikan penalti tegas ($\times 0.55$) apabila guncangan didominasi arah horizontal ($\text{vert\_to\_horiz\_ratio} < 0.75$), sehingga pengereman mendadak atau goyangan HP tetap tertolak.

3. **Tier 3 — Mode C (`LEGACY_CALIBRATED_HEURISTIC` - Darurat Buffer Pendek)**:
   - Hanya digunakan pada detik pertama perjalanan jika buffer sensor belum mencapai 15 sampel namun kendaraan langsung menghantam lubang besar ($\text{peakZ} \ge \text{zShockThreshold} \times 1.15$).

---

## 4. Penentuan Tingkat Keparahan (`Severity Classification`)

Setiap titik yang lolos ambang batas probabilitas ($P \ge 0.50$) diklasifikasikan ke dalam salah satu dari 3 tingkat keparahan (`Severity`) di [`edge-ai/model-config.ts`](../../edge-ai/model-config.ts) berdasarkan kombinasi skor probabilitas model ($P$) dan puncak percepatan vertikal ($Z_{peak}$):

| Tingkat Keparahan (`Severity`) | Syarat Probabilitas / Amplitudo G-Force | Warna Indikator UI | Makna Kondisi Fisik Jalan |
| :--- | :--- | :--- | :--- |
| **`Heavy` (Rusak Berat)** | $P \ge 0.85$ **atau** $Z_{peak} \ge 3.0\text{ G}$ | 🔴 Merah (`#EF4444`) | Lubang dalam / patahan aspal tajam yang berisiko merusak velg atau membahayakan pengendara motor |
| **`Medium` (Rusak Sedang)** | $0.68 \le P < 0.85$ **atau** $Z_{peak} \ge 2.0\text{ G}$ | 🟠 Amber (`#F59E0B`) | Lubang ukuran sedang atau permukaan aspal amblas yang menimbulkan guncangan keras pada suspensi |
| **`Light` (Rusak Ringan)** | $0.50 \le P < 0.68$ | 🔵 Cyan (`#06B6D4`) | Lubang dangkal, tambalan jalan tidak rata, atau retakan aspal bergelombang |
