/**
 * Tipe & data geografis untuk peta HyperGrid.
 *
 * Peta memakai `react-native-maps` (Google Maps di Android, Apple Maps /
 * Google Maps di iOS) dan library ini sudah termasuk di Expo Go.
 * File ini adalah SATU-SATUNYA sumber data geografis aplikasi — semua layer
 * (rute, titik kerusakan, posisi user, posisi kendaraan) digambar dari sini.
 *
 * TODO(Tahap 2): ganti isi konstanta di bawah dengan data dari API,
 * misal:
 *   export async function fetchMapData(): Promise<MapData> {
 *     const res = await fetch(`${API_URL}/map?lat=-6.2&lng=106.82`)
 *     return res.json()
 *   }
 * Bentuk datanya sudah sengaja dibuat sama dengan payload API agar
 * komponen peta tidak perlu diubah saat backend siap.
 */

export type LatLng = {
  latitude: number
  longitude: number
}

/** Tingkat keparahan kerusakan jalan. */
export type DamageSeverity = "severe" | "high" | "medium" | "low"

/**
 * Satu titik kerusakan jalan di peta.
 * `reportCount` = jumlah laporan yang terkumpul di titik tersebut.
 */
export type DamagePoint = {
  id: string
  position: LatLng
  severity: DamageSeverity
  reportCount: number
  radius_meters?: number
  userCount?: number
  points?: { latitude: number; longitude: number; intensity?: number }[]
}

/**
 * Ringkasan ruas jalan area makro (~1 km).
 * Ditampilkan ketika peta berada pada level zoom jauh (zoom < 14).
 */
export type AreaSummary = {
  id: string;
  center: LatLng;
  radiusMeters: number;
  clusterCount: number;
  totalReports: number;
  worstSeverity: DamageSeverity;
  severityCounts: Record<DamageSeverity, number>;
  clusters: DamagePoint[];
};

/** Seluruh data yang dibutuhkan satu layar untuk menggambar peta. */
export type MapData = {
  /** Posisi tengah peta + level zoom kamera. */
  camera: LatLng & { zoom: number }
  /** Polyline rute yang sedang dilalui. */
  route: {
    id: string
    coordinates: LatLng[]
  }
  /** Titik kerusakan jalan yang tampil di peta. */
  damagePoints: DamagePoint[]
  /** Data heatmap sebaran intensitas kerusakan jalan [lat, lon, intensity 0..1]. */
  heatmap?: [number, number, number][]
  /** ID klaster yang sedang aktif/diklik untuk di-highlight cakupan areanya */
  activeClusterId?: string | null
  /** ID area makro (~1 km) yang sedang aktif */
  activeAreaId?: string | null
  /** Posisi pengguna (titik biru). */
  userLocation: LatLng
  /** Posisi kendaraan aktif (ikon kendaraan). */
  vehiclePosition: LatLng
}

/**
 * Mengelompokkan titik klaster ke dalam grid spasial ruas jalan makro berukuran ~1 km (~1000m).
 * Digunakan untuk Level of Detail (LOD) peta saat kamera berada pada tampilan jauh (zoom < 14).
 */
export function aggregateClustersTo1KmAreas(
  points: DamagePoint[],
  cellMeters: number = 1000
): AreaSummary[] {
  if (!points || points.length === 0) return [];
  // 1 derajat lintang approx 111,320 meter (sekitar 0.009 derajat per 1 km)
  const degSize = cellMeters / 111320;
  const grid = new Map<string, DamagePoint[]>();

  for (const pt of points) {
    const cellLat = Math.floor(pt.position.latitude / degSize);
    const cellLng = Math.floor(pt.position.longitude / degSize);
    const key = `${cellLat}:${cellLng}`;
    const list = grid.get(key) || [];
    list.push(pt);
    grid.set(key, list);
  }

  const areas: AreaSummary[] = [];
  grid.forEach((group, key) => {
    let sumLat = 0;
    let sumLng = 0;
    let totalReports = 0;
    const severityCounts: Record<DamageSeverity, number> = {
      severe: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const p of group) {
      sumLat += p.position.latitude;
      sumLng += p.position.longitude;
      totalReports += p.reportCount || 1;
      if (p.severity in severityCounts) {
        severityCounts[p.severity]++;
      }
    }

    let worstSeverity: DamageSeverity = "low";
    if (severityCounts.severe > 0) worstSeverity = "severe";
    else if (severityCounts.high > 0) worstSeverity = "high";
    else if (severityCounts.medium > 0) worstSeverity = "medium";

    areas.push({
      id: `area-1km-${key}`,
      center: {
        latitude: sumLat / group.length,
        longitude: sumLng / group.length,
      },
      radiusMeters: cellMeters,
      clusterCount: group.length,
      totalReports,
      worstSeverity,
      severityCounts,
      clusters: group,
    });
  });

  return areas;
}

/**
 * Warna sesuai design system Figma "Final Page Mobile":
 *   - Severe #991B1B (marker `Dark Crimson`)
 *   - High   #B3261E (marker `Red`)
 *   - Medium #F59E0B (marker `Yellow 1` / Semantic-Warning)
 *   - Low    #FFFF00 (marker `Yellow 2`)
 */
export const SEVERITY_COLOR: Record<DamageSeverity, string> = {
  severe: "#991B1B",
  high: "#B3261E",
  medium: "#F59E0B",
  low: "#FFFF00",
}

/** Warna jalur rute Figma #114:1272. */
export const ROUTE_COLOR = "#2985FF"

/** Warna titik user Figma `You` #I114:1274;2:723. */
export const USER_COLOR = "#1A73E8"

/* ------------------------------------------------------------------ */
/* Dummy data — koridor Jalan Sudirman, Jakarta                        */
/* TODO(Tahap 2): hapus setelah data dibaca dari API                  */
/* ------------------------------------------------------------------ */

const ROUTE_COORDINATES: LatLng[] = [
  { latitude: -6.2088, longitude: 106.8206 },
  { latitude: -6.2042, longitude: 106.8215 },
  { latitude: -6.1989, longitude: 106.8225 },
  { latitude: -6.1951, longitude: 106.8232 },
  { latitude: -6.1913, longitude: 106.823 },
  { latitude: -6.1883, longitude: 106.8223 },
  { latitude: -6.1849, longitude: 106.8227 },
]

const DUMMY_DAMAGE_POINTS: DamagePoint[] = [
  {
    id: "damage-1",
    position: { latitude: -6.2032, longitude: 106.8219 },
    severity: "high",
    reportCount: 30,
  },
  {
    id: "damage-2",
    position: { latitude: -6.1969, longitude: 106.8228 },
    severity: "medium",
    reportCount: 21,
  },
  {
    id: "damage-3",
    position: { latitude: -6.1878, longitude: 106.8217 },
    severity: "low",
    reportCount: 14,
  },
]

/** Data peta untuk Main Page (Start) — Figma `Main page` #114:1267. */
export const MAIN_MAP_DATA: MapData = {
  camera: { latitude: -6.1965, longitude: 106.822, zoom: 14 },
  route: { id: "route-main", coordinates: ROUTE_COORDINATES },
  damagePoints: DUMMY_DAMAGE_POINTS,
  userLocation: { latitude: -6.1995, longitude: 106.8224 },
  vehiclePosition: { latitude: -6.206, longitude: 106.8209 },
}

/** Data peta untuk Drive Mode — Figma `start driving` #114:1384 (kamera lebih dekat). */
export const RIDE_MAP_DATA: MapData = {
  ...MAIN_MAP_DATA,
  camera: { latitude: -6.1995, longitude: 106.8224, zoom: 15.5 },
  route: { id: "route-ride", coordinates: ROUTE_COORDINATES },
}

/**
 * Data peta untuk kartu preview di Riwayat Perjalanan.
 * TODO(Tahap 2): buat varian per hari dari `HISTORY_BY_DAY` + API.
 */
export const HISTORY_MAP_DATA: MapData = {
  ...MAIN_MAP_DATA,
  camera: { latitude: -6.1965, longitude: 106.822, zoom: 13.5 },
  route: { id: "route-history", coordinates: ROUTE_COORDINATES },
}

/**
 * Area yang ditampilkan pada fallback web (gambar statis).
 * `react-native-maps` tidak berjalan di web, jadi preview browser memakai
 * proyeksi linier sederhana agar data geografis tetap tampil.
 */
export const WEB_VIEWPORT = {
  north: -6.183,
  south: -6.21,
  east: 106.8255,
  west: 106.8185,
}

/** Proyeksi lat/lng → persen (0-100) untuk fallback web. */
export function projectToPercent(position: LatLng): {
  left: `${number}%`
  top: `${number}%`
} {
  const x = (position.longitude - WEB_VIEWPORT.west) / (WEB_VIEWPORT.east - WEB_VIEWPORT.west)
  const y = (WEB_VIEWPORT.north - position.latitude) / (WEB_VIEWPORT.north - WEB_VIEWPORT.south)

  return {
    left: `${x * 100}%` as `${number}%`,
    top: `${y * 100}%` as `${number}%`,
  }
}
