import { StaticMapFallback } from "./static-map-fallback";
import type { HypergridMapProps } from "./hypergrid-map";

/**
 * Versi web dari peta HyperGrid.
 *
 * Metro memilih file ini otomatis saat bundling web, sehingga
 * `react-native-maps` (yang tidak berjalan di browser) tidak pernah ikut
 * ter-import. Preview di browser memakai gambar statis Figma, tetapi tetap
 * memakai data geografis yang sama (`MapData`) — hanya posisinya diproyeksikan
 * linier ke dalam gambar.
 *
 * Di device (iOS/Android) file ini tidak pernah dipakai.
 */
export function HypergridMap({ data, vehicleIcon }: HypergridMapProps) {
  return <StaticMapFallback data={data} vehicleIcon={vehicleIcon} />
}
