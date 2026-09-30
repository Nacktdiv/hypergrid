/**
 * Dummy data untuk Halaman Riwayat Perjalanan (Screen 7).
 *
 * Referensi desain: Figma page "Final Page Mobile".
 * Page itu tidak punya frame History, jadi komponen ini memakai design
 * language yang sama dengan `Main page` #114:1267 dan `Profile` #114:1309:
 *   - kartu putih, border 1px #E2E2E2, radius 24
 *   - map card radius 16, border 1px #CAD5E2, jalur #2985FF putus-putus
 *   - marker berbentuk lingkaran 36px radius 20 + hitungan JetBrains Mono
 *   - Judul Chivo 600/700, body Quicksand, angka JetBrains Mono
 *
 * TODO: ganti dengan data API saat Tahap 2.
 * Data di bawah adalah konstanta dummy — tidak ada perhitungan.
 */

export type DayOption = {
  /** Kode hari untuk React key, mis. "sen" */
  id: string
  /** Label singkat 3 huruf, mis. "Sen" */
  short: string
  /** Tanggal angka, mis. "22" */
  date: string
  /** Tanggal panjang untuk header */
  longLabel: string
}

/**
 * Deret 7 hari. Urutan dan tanggal berdasar kalender (22–28 Sep 2026,
 * Senin–Minggu) sehingga urutan hari/weekend masuk akal.
 */
export const DAYS: DayOption[] = [
  { id: "sen", short: "Sen", date: "22", longLabel: "Senin, 22 Sep 2026" },
  { id: "sel", short: "Sel", date: "23", longLabel: "Selasa, 23 Sep 2026" },
  { id: "rab", short: "Rab", date: "24", longLabel: "Rabu, 24 Sep 2026" },
  { id: "kam", short: "Kam", date: "25", longLabel: "Kamis, 25 Sep 2026" },
  { id: "jum", short: "Jum", date: "26", longLabel: "Jumat, 26 Sep 2026" },
  { id: "sab", short: "Sab", date: "27", longLabel: "Sabtu, 27 Sep 2026" },
  { id: "min", short: "Min", date: "28", longLabel: "Minggu, 28 Sep 2026" },
]

/** Id hari yang terpilih saat layar dibuka */
export const DEFAULT_DAY_ID = "jum"

export type Metric = {
  id: string
  label: string
  value: string
  unit?: string
  /** Warna aksen ikon */
  accent: string
}

/** Metrik harian, diindeks berdasarkan id hari */
export const METRICS_BY_DAY: Record<string, Metric[]> = {
  sen: [
    { id: "rusak", label: "Titik Rusak", value: "4", unit: "lokasi", accent: "#B3261E" },
    { id: "jarak", label: "Jarak Tempuh", value: "9.8", unit: "KM", accent: "#009EFF" },
    { id: "waktu", label: "Waktu Tempuh", value: "24", unit: "Menit", accent: "#F59E0B" },
  ],
  sel: [
    { id: "rusak", label: "Titik Rusak", value: "2", unit: "lokasi", accent: "#B3261E" },
    { id: "jarak", label: "Jarak Tempuh", value: "6.1", unit: "KM", accent: "#009EFF" },
    { id: "waktu", label: "Waktu Tempuh", value: "17", unit: "Menit", accent: "#F59E0B" },
  ],
  rab: [
    { id: "rusak", label: "Titik Rusak", value: "9", unit: "lokasi", accent: "#B3261E" },
    { id: "jarak", label: "Jarak Tempuh", value: "21.4", unit: "KM", accent: "#009EFF" },
    { id: "waktu", label: "Waktu Tempuh", value: "48", unit: "Menit", accent: "#F59E0B" },
  ],
  kam: [
    { id: "rusak", label: "Titik Rusak", value: "5", unit: "lokasi", accent: "#B3261E" },
    { id: "jarak", label: "Jarak Tempuh", value: "12.7", unit: "KM", accent: "#009EFF" },
    { id: "waktu", label: "Waktu Tempuh", value: "29", unit: "Menit", accent: "#F59E0B" },
  ],
  jum: [
    { id: "rusak", label: "Titik Rusak", value: "7", unit: "lokasi", accent: "#B3261E" },
    { id: "jarak", label: "Jarak Tempuh", value: "14.2", unit: "KM", accent: "#009EFF" },
    { id: "waktu", label: "Waktu Tempuh", value: "32", unit: "Menit", accent: "#F59E0B" },
  ],
  sab: [
    { id: "rusak", label: "Titik Rusak", value: "11", unit: "lokasi", accent: "#B3261E" },
    { id: "jarak", label: "Jarak Tempuh", value: "26.9", unit: "KM", accent: "#009EFF" },
    { id: "waktu", label: "Waktu Tempuh", value: "55", unit: "Menit", accent: "#F59E0B" },
  ],
  min: [
    { id: "rusak", label: "Titik Rusak", value: "1", unit: "lokasi", accent: "#B3261E" },
    { id: "jarak", label: "Jarak Tempuh", value: "3.2", unit: "KM", accent: "#009EFF" },
    { id: "waktu", label: "Waktu Tempuh", value: "11", unit: "Menit", accent: "#F59E0B" },
  ],
}

export type HistoryEntry = {
  id: string
  from: string
  to: string
  time: string
  date: string
  guncangan: number
  distance: string
  /** Catatan singkat yang muncul saat kartu diketuk */
  note: string
}

/** Riwayat per hari, diindeks berdasarkan id hari */
export const HISTORY_BY_DAY: Record<string, HistoryEntry[]> = {
  sen: [
    {
      id: "sen-1",
      from: "Rumah",
      to: "Kampus ITB",
      time: "06:50 - 07:05",
      date: "22/09/26",
      guncangan: 2,
      distance: "5.1 KM",
      note: "2 guncangan tercatat di Jalan Merdeka.",
    },
    {
      id: "sen-2",
      from: "Kampus ITB",
      to: "Grand Indonesia",
      time: "12:15 - 12:38",
      date: "22/09/26",
      guncangan: 2,
      distance: "4.7 KM",
      note: "Rute mengikuti Jalan Asia Afrika.",
    },
  ],
  sel: [
    {
      id: "sel-1",
      from: "Rumah",
      to: "Stasiun Bandung",
      time: "07:30 - 07:44",
      date: "23/09/26",
      guncangan: 0,
      distance: "3.3 KM",
      note: "Perjalanan tanpa guncangan terdeteksi.",
    },
    {
      id: "sel-2",
      from: "Stasiun Bandung",
      to: "Cimahi",
      time: "16:02 - 16:19",
      date: "23/09/26",
      guncangan: 2,
      distance: "2.8 KM",
      note: "2 guncangan ringan di Jalan Setiabudi.",
    },
  ],
  rab: [
    {
      id: "rab-1",
      from: "Rumah",
      to: "Cimahi",
      time: "08:05 - 08:29",
      date: "24/09/26",
      guncangan: 5,
      distance: "7.9 KM",
      note: "5 guncangan, 2 di antaranya parah.",
    },
    {
      id: "rab-2",
      from: "Cimahi",
      to: "Margahayu",
      time: "10:40 - 10:58",
      date: "24/09/26",
      guncangan: 4,
      distance: "6.2 KM",
      note: "Jalan berlubang di sekitar Km 12.",
    },
    {
      id: "rab-3",
      from: "Margahayu",
      to: "Rumah",
      time: "19:10 - 19:32",
      date: "24/09/26",
      guncangan: 0,
      distance: "7.3 KM",
      note: "Perjalanan pulang bersih.",
    },
  ],
  kam: [
    {
      id: "kam-1",
      from: "Rumah",
      to: "Bandung Trade Center",
      time: "09:00 - 09:26",
      date: "25/09/26",
      guncangan: 3,
      distance: "8.4 KM",
      note: "3 guncangan di jalan Gatot Subroto.",
    },
    {
      id: "kam-2",
      from: "Bandung Trade Center",
      to: "Rumah",
      time: "18:22 - 18:45",
      date: "25/09/26",
      guncangan: 2,
      distance: "4.3 KM",
      note: "Rute alternatif via Jalan Sumbar.",
    },
  ],
  jum: [
    {
      id: "jum-1",
      from: "Rumah",
      to: "Kampus ITB",
      time: "07:15 - 07:32",
      date: "26/09/26",
      guncangan: 3,
      distance: "6.4 KM",
      note: "3 guncangan di depan gerbang universitas.",
    },
    {
      id: "jum-2",
      from: "Kampus ITB",
      to: "Grand Indonesia",
      time: "09:40 - 10:08",
      date: "26/09/26",
      guncangan: 1,
      distance: "4.1 KM",
      note: "1 guncangan ringan.",
    },
    {
      id: "jum-3",
      from: "Grand Indonesia",
      to: "Rumah",
      time: "18:20 - 18:47",
      date: "26/09/26",
      guncangan: 3,
      distance: "3.7 KM",
      note: "3 guncangan setelah hujan.",
    },
  ],
  sab: [
    {
      id: "sab-1",
      from: "Rumah",
      to: "Puncak Bromo",
      time: "05:30 - 07:48",
      date: "27/09/26",
      guncangan: 6,
      distance: "16.2 KM",
      note: "6 guncangan, kondisi jalan menurun.",
    },
    {
      id: "sab-2",
      from: "Puncak Bromo",
      to: "Tamanpute",
      time: "09:15 - 10:02",
      date: "27/09/26",
      guncangan: 5,
      distance: "10.7 KM",
      note: "5 guncangan di tikungan turi.",
    },
  ],
  min: [
    {
      id: "min-1",
      from: "Rumah",
      to: "Kafe",
      time: "10:00 - 10:11",
      date: "28/09/26",
      guncangan: 1,
      distance: "3.2 KM",
      note: "1 guncangan di jalan masuk kompleks.",
    },
  ],
}
