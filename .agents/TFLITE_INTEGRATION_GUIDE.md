# HyperGrid TFLite Model Integration Guide
**Untuk React Native Expo SDK 57 (react-native-fast-tflite)**

Dokumen ini berisi panduan lengkap integrasi model Machine Learning **HyperGrid v2 (`hg_model_v2.tflite`)** pada aplikasi React Native menggunakan Expo SDK 57.

Model ini dirancang khusus untuk kompatibilitas ke belakang (backward compatibility) pada framework TensorFlow Lite standar (tanpa custom ops), memungkinkannya berjalan pada berbagai perangkat mobile secara efisien.

---

## 1. Spesifikasi Model TFLite

| Properti | Detail |
| :--- | :--- |
| **Nama Berkas** | `hg_model_v2.tflite` |
| **Tipe Model** | TensorFlow Lite (Lightweight Neural Network proxy dari XGBoost) |
| **Tipe Input Tensor** | `float32` |
| **Dimensi Input** | `[1, 47]` (Tipe: `float32`) |
| **Output Tensor** | `[1, 1]` $\rightarrow$ `float32` (Probabilitas Lubang) |
| **Optimal Decision Threshold** | **`0.50`** (Probabilitas $\ge 0.50$ diklasifikasikan sebagai Pothole) |
| **Kompatibilitas** | Expo SDK 57 + `react-native-fast-tflite` |

---

## 2. Urutan 47 Fitur Input Tensor (V2)

Model V2 mengharapkan array `Float32Array` yang berisi tepat **47 fitur** dalam urutan berikut:

1. `vert_dyn_mean`, `vert_dyn_std`, `vert_dyn_min`, `vert_dyn_max`, `vert_dyn_range`, `vert_dyn_rms` (6 fitur vertikal)
2. `horiz_dyn_mean`, `horiz_dyn_std`, `horiz_dyn_min`, `horiz_dyn_max`, `horiz_dyn_range`, `horiz_dyn_rms` (6 fitur horizontal)
3. `acc_mag_mean`, `acc_mag_std`, `acc_mag_min`, `acc_mag_max`, `acc_mag_range`, `acc_mag_rms` (6 fitur acc total)
4. `gyro_mag_mean`, `gyro_mag_std`, `gyro_mag_min`, `gyro_mag_max`, `gyro_mag_range`, `gyro_mag_rms` (6 fitur gyro total)
5. `jerk_vert_mean`, `jerk_vert_std`, `jerk_vert_min`, `jerk_vert_max`, `jerk_vert_range`, `jerk_vert_rms` (6 fitur jerk vertikal)
6. `gyro_jerk_mean`, `gyro_jerk_std`, `gyro_jerk_min`, `gyro_jerk_max`, `gyro_jerk_range`, `gyro_jerk_rms` (6 fitur jerk gyro)
7. `speed_clean_mean`, `speed_clean_std`, `speed_clean_min`, `speed_clean_max`, `speed_clean_range`, `speed_clean_rms` (6 fitur kecepatan)
8. `crest_factor_vert`, `vert_to_horiz_ratio`, `speed_norm_vert_shock`, `vert_zcr`, `is_moving` (5 fitur kustom)

---

## 3. Instalasi dan Setup pada Expo SDK 57

Untuk menggunakan model TFLite pada React Native Expo SDK 57, Anda dapat menggunakan modul `react-native-fast-tflite`.

1. **Instalasi library:**
```bash
npx expo install react-native-fast-tflite
```

2. **Tambahkan file model ke aset proyek:**
Letakkan file `hg_model_v2.tflite` di dalam folder `assets/models/` (atau folder serupa).
Agar bundler Metro dapat mengenali ekstensi `.tflite`, perbarui konfigurasi `metro.config.js`:
```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('tflite');

module.exports = config;
```

---

## 4. Contoh Implementasi Loading & Prediksi

```typescript
import { useState, useEffect } from 'react';
import { useTensorflowModel } from 'react-native-fast-tflite';

// Threshold optimal dari proses pelatihan
const OPTIMAL_THRESHOLD = 0.50;

export function useHypergridModel() {
  // Load model secara asinkron
  const model = useTensorflowModel(require('./assets/models/hg_model_v2.tflite'));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (model.state === 'loaded') {
      setIsReady(true);
    }
  }, [model.state]);

  /**
   * Melakukan inferensi menggunakan array 47 fitur.
   * Pastikan array input (`features`) panjangnya tepat 47 dan bertipe number[].
   */
  const predictPothole = async (features: number[]) => {
    if (!isReady || !model.model) {
      throw new Error("Model belum dimuat dengan sempurna.");
    }
    if (features.length !== 47) {
      throw new Error(`Input harus memiliki 47 fitur, tetapi menerima ${features.length}`);
    }

    // Convert input ke Float32Array
    const inputBuffer = new Float32Array(features);

    // Jalankan inferensi
    const outputs = await model.model.run([inputBuffer]);

    // Output adalah probabilitas pothole
    // @ts-ignore - typecast output buffer
    const potholeProbability = outputs[0][0] as number;
    
    // Tentukan tingkat keyakinan (Confidence Tier) V2
    let confidenceTier = 'LOW';
    let confidenceScore = 0;
    
    if (potholeProbability >= OPTIMAL_THRESHOLD) {
      confidenceScore = potholeProbability;
    } else {
      confidenceScore = 1.0 - potholeProbability;
    }
    
    if (confidenceScore >= 0.8) confidenceTier = 'HIGH';
    else if (confidenceScore >= 0.6) confidenceTier = 'MEDIUM';
    
    return {
      isPothole: potholeProbability >= OPTIMAL_THRESHOLD,
      probability: potholeProbability,
      confidenceScore,
      confidenceTier
    };
  };

  return { predictPothole, isReady, error: model.error };
}
```

## 5. Pertimbangan Performa
1. **Model Cache**: Pastikan model tidak diload berulang-ulang setiap frame. Gunakan React Context atau statik variabel jika diperlukan secara global.
2. **Buffer Pooling**: Saat merangkai 47 fitur secara real-time, usahakan memakai buffer tetap dan meminimalkan alokasi memori berulang dari sensor.
