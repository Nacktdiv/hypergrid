# 4.3. Design System Tokens, Komponen UI, & Arsitektur Layar

> **Bagian:** `04-mobile-features-ui` • [⬅️ Engine Peta & Live Drive HUD](./02-maps-and-navigation-hud.md) • [🏠 Indeks Utama](../README.md) • [Lanjut ke Bagian 5: Changelog & Roadmap ➡️](../05-history-and-roadmap/01-changelog-history.md)

---

## 1. Filosofi Desain & Design System Tokens (`lib/theme/tokens.ts`)

Antarmuka HyperGrid mengusung estetika **Dark Tactical Telemetry** yang dioptimalkan untuk penggunaan di dalam kabin kendaraan (kontras tinggi, tidak menyilaukan mata saat berkendara malam hari, dan tipografi monospasi untuk angka telemetri).

Seluruh token desain dikelola secara terpusat di [`lib/theme/tokens.ts`](../../lib/theme/tokens.ts):

### 1.1. Palet Warna Semantik
| Kategori | Token | Kode Hex | Penggunaan Utama |
| :--- | :--- | :---: | :--- |
| **Background Canvas** | `bg.canvas` / `bg.elevated` | `#090E1A` / `#131B2E` | Latar belakang utama layar dan kartu permukaan (*surface cards*) |
| **Primary Brand** | `brand.primary` | `#2563EB` | Tombol aksi utama (*Start Drive*), tab aktif, dan aksen interaktif |
| **Severity Heavy** | `severity.heavy` | `#EF4444` (Merah) | Indikator lubang jalan rusak berat & alert bahaya |
| **Severity Medium** | `severity.medium` | `#F59E0B` (Amber) | Indikator lubang jalan rusak sedang & peringatan dini |
| **Severity Light** | `severity.light` | `#06B6D4` (Cyan) | Indikator kerusakan ringan / permukaan jalan bergelombang |
| **Status Repaired** | `status.repaired` | `#10B981` (Emerald) | Klaster jalan yang telah selesai diperbaiki oleh Dinas PU |

### 1.2. Sistem Tipografi Tiga Keluarga Font
- **Display & Heading (`Chivo_700Bold` / `Chivo_900Black`)**: Digunakan untuk judul halaman, header kartu, dan label utama yang tegas.
- **Body & UI Controls (`Quicksand_600SemiBold` / `Quicksand_700Bold`)**: Digunakan untuk teks deskripsi, tombol, dan navigasi yang ramah dibaca.
- **Telemetry & Numerics (`JetBrainsMono_700Bold`)**: Digunakan untuk angka kecepatan (`km/h`), percepatan (`G-Force`), koordinat GPS, dan persentase akurasi AI agar lebar digit tidak bergeser saat berubah cepat.

---

## 2. Katalog Komponen Primitif (`components/ui/*`)

Untuk memastikan konsistensi visual di seluruh layar, HyperGrid menyediakan pustaka komponen UI internal:

| Komponen | Lokasi File | Deskripsi & Kegunaan |
| :--- | :--- | :--- |
| **`AppButton`** | [`components/ui/app-button.tsx`](../../components/ui/app-button.tsx) | Tombol standar dengan dukungan varian `primary`, `secondary`, `outline`, `ghost`, `danger`, dan `circle` beserta indikator loading. |
| **`AppCard`** | [`components/ui/app-card.tsx`](../../components/ui/app-card.tsx) | Kontainer kartu dengan border halus `rgba(255,255,255,0.07)` dan sudut membulat konsisten. |
| **`SlideCommit`** | [`components/ui/slide-commit.tsx`](../../components/ui/slide-commit.tsx) | Slider geser interaktif berbasis `PanResponder` untuk mengonfirmasi penghentian perjalanan (*Slide to End Trip*). |
| **`StatusBadge`** | [`components/ui/status-badge.tsx`](../../components/ui/status-badge.tsx) | Badge lencana otomatis untuk menampilkan tingkat keparahan (`Heavy`, `Medium`, `Light`) atau status klaster (`Active`, `Verified`, `Repaired`). |
| **`MetricPill`** | [`components/ui/metric-pill.tsx`](../../components/ui/metric-pill.tsx) | Pil indikator ringkas untuk menampilkan pasangan ikon, label, dan nilai metrik. |
| **`TopFloatingHeader`** | [`components/ui/top-floating-header.tsx`](../../components/ui/top-floating-header.tsx) | Bar atas melayang di atas kanvas peta dengan efek *glassmorphism* gelap. |
| **`ActionRow`** | [`components/ui/action-row.tsx`](../../components/ui/action-row.tsx) | Baris item menu interaktif yang digunakan pada daftar pengaturan dan informasi profil. |

---

## 3. Arsitektur Layar Utama Aplikasi (`app/*`)

### 3.1. Halaman Utama & Swipeable Bottom Drawer (`app/(tabs)/index.tsx`)
- Menampilkan `MainMap` secara *full-bleed* (100% tinggi layar).
- Di bagian bawah terdapat **Google Maps-Style Swipeable Bottom Drawer** yang dikendalikan oleh `PanResponder` dan `Animated.spring`:
  - **Kondisi Terbuka (*Expanded*)**: Menampilkan pemilih kendaraan (`VehicleSelector`), ringkasan kalibrasi sensor aktif, dan tombol besar **Start Drive** (`PlayButton`).
  - **Kondisi Tertutup (*Collapsed*)**: Pengguna dapat menggeser drawer ke bawah hingga menyisakan *peek bar* ringkas (tinggi `128px`) sehingga pengguna dapat menjelajahi peta klaster lubang jalan secara leluasa.

### 3.2. Halaman Riwayat Perjalanan Pribadi (`app/(tabs)/history.tsx`)
- **Pemilih Tanggal (`DaySelector`)**: Menampilkan 7 hari terakhir beserta tombol untuk membuka **Modal Kalender Bulanan** lengkap.
- **Konversi Zona Waktu Lokal (`date-utils.ts`)**: Memastikan deteksi yang terekam pada malam hari (mis. pukul 21:00 WIB) tetap masuk ke tanggal lokal hari tersebut dan tidak bergeser ke hari berikutnya akibat perbedaan UTC.
- **Ringkasan & Peta Rute Harian (`MetricsSummary` & `RouteMapPreview`)**: Merangkum jumlah lubang yang ditemukan oleh pengguna pada tanggal terpilih, rata-rata akurasi AI, puncak G-Force, serta memvisualisasikan jejak titik-titik deteksi di atas peta.

### 3.3. Halaman Profil & Spesifikasi Kendaraan (`app/(tabs)/profile.tsx`)
- Menampilkan [`ProfileHeader`](../../components/profile/profile-header.tsx) dengan foto/inisial akun dan status sesi.
- Menampilkan [`SelectedVehicleCard`](../../components/profile/selected-vehicle-card.tsx) yang otomatis berubah mengikuti pilihan kendaraan di halaman utama (lengkap dengan gambar kendaraan Toyota Avanza / Honda Vario / Polygon Sierra dan spesifikasi ambang sensornya).
- Menyediakan fitur **Edit Personal Info** (mengubah nama tampilan & nomor telepon dengan penyimpanan persisten) serta tombol **Logout**.
