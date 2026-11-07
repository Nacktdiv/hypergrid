import type { LatLng } from '@/components/map/map-data';
import type { PotholeCluster } from '@/types/api';

export interface SearchLocationResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface RouteHazardAnalysis {
  totalHazards: number;
  severeCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  hazardsAlongRoute: PotholeCluster[];
  hazardDensityPerKm: number;
  safetyRating: 'safe' | 'caution' | 'dangerous';
  safetyLabel: string;
}

export interface PlannedRoute {
  id: string;
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  startPoint: LatLng;
  destinationPoint: LatLng;
  destinationName: string;
  destinationAddress?: string;
  hazards: RouteHazardAnalysis;
}

/**
 * Jarak titik ke ruas garis (Point-to-Segment Distance) dalam meter
 * menggunakan proyeksi Kartesius lokal terkalibrasi kosinus lintang bumi.
 */
function distanceToSegmentMeters(
  point: LatLng,
  segA: LatLng,
  segB: LatLng
): number {
  const DEG_TO_METERS = 111_320;
  const latRad = ((segA.latitude + segB.latitude) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(latRad);

  const ax = segA.longitude * DEG_TO_METERS * cosLat;
  const ay = segA.latitude * DEG_TO_METERS;
  const bx = segB.longitude * DEG_TO_METERS * cosLat;
  const by = segB.latitude * DEG_TO_METERS;
  const px = point.longitude * DEG_TO_METERS * cosLat;
  const py = point.latitude * DEG_TO_METERS;

  const dx = bx - ax;
  const dy = by - ay;
  const segLenSq = dx * dx + dy * dy;

  if (segLenSq < 1e-6) {
    const diffX = px - ax;
    const diffY = py - ay;
    return Math.sqrt(diffX * diffX + diffY * diffY);
  }

  // Parameter proyeksi titik ke ruas garis [0, 1]
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / segLenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  const distX = px - projX;
  const distY = py - projY;
  return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Service Navigasi, Pencarian Tujuan (Nominatim) & Perutean Cerdas (OSRM)
 * terintegrasi dengan analisis densitas lubang jalan HyperGrid.
 */
export const routingService = {
  /**
   * Cari lokasi/tujuan menggunakan OpenStreetMap Nominatim Geocoding API.
   */
  async searchLocation(query: string): Promise<SearchLocationResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) return [];

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        cleanQuery
      )}&countrycodes=id&limit=6&addressdetails=1`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'HyperGrid-Road-Safety-App/1.0 (contact@hypergrid.io)',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        },
      });

      if (!res.ok) {
        throw new Error(`Nominatim error: ${res.status}`);
      }

      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((item: any) => {
        const parts = (item.display_name || '').split(',');
        const primaryName = parts[0]?.trim() || cleanQuery;
        const subAddress = parts.slice(1, 4).join(',').trim();

        return {
          id: String(item.place_id || Math.random()),
          name: primaryName,
          address: subAddress || item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        };
      });
    } catch (err) {
      console.warn('[routingService] Geocoding gagal:', err);
      return [];
    }
  },

  /**
   * Hitung rute mengemudi mengunakan OSRM Driving Engine API.
   */
  async calculateRoute(
    start: LatLng,
    destination: LatLng,
    destinationName = 'Destination',
    clusters: PotholeCluster[] = []
  ): Promise<PlannedRoute | null> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=false`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`OSRM error: ${res.status}`);
      }

      const data = await res.json();
      if (!data?.routes || data.routes.length === 0) {
        return null;
      }

      const mainRoute = data.routes[0];
      const rawCoords = mainRoute.geometry?.coordinates || [];

      const coordinates: LatLng[] = rawCoords.map(([lon, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lon,
      }));

      // Analisis sebaran & densitas lubang jalan sepanjang koridor rute
      const hazards = this.analyzeRouteHazards(
        coordinates,
        clusters,
        mainRoute.distance
      );

      return {
        id: `route_${Date.now()}`,
        coordinates,
        distanceMeters: Math.round(mainRoute.distance),
        durationSeconds: Math.round(mainRoute.duration),
        startPoint: start,
        destinationPoint: destination,
        destinationName,
        hazards,
      };
    } catch (err) {
      console.warn('[routingService] OSRM routing gagal:', err);
      // Fallback: garis lurus (great circle) jika OSRM sedang down
      const fallbackCoords: LatLng[] = [start, destination];
      const hazards = this.analyzeRouteHazards(fallbackCoords, clusters, 1000);
      return {
        id: `route_direct_${Date.now()}`,
        coordinates: fallbackCoords,
        distanceMeters: 1000,
        durationSeconds: 120,
        startPoint: start,
        destinationPoint: destination,
        destinationName,
        hazards,
      };
    }
  },

  /**
   * Analisis densitas klaster anomali / lubang jalan yang dilintasi rute perjalanan.
   * Menggunakan buffer koridor jalan selebar 35 meter.
   */
  analyzeRouteHazards(
    routeCoords: LatLng[],
    clusters: PotholeCluster[],
    distanceMeters = 1000,
    bufferMeters = 35
  ): RouteHazardAnalysis {
    if (routeCoords.length < 2 || clusters.length === 0) {
      return {
        totalHazards: 0,
        severeCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        hazardsAlongRoute: [],
        hazardDensityPerKm: 0,
        safetyRating: 'safe',
        safetyLabel: 'Kondisi Jalan Mulus',
      };
    }

    const matchedClusters: PotholeCluster[] = [];
    let severeCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const c of clusters) {
      if (c.status === 'repaired' || c.status === 'false_positive') continue;
      if (typeof c.center_latitude !== 'number' || typeof c.center_longitude !== 'number') {
        continue;
      }

      const clusterPos: LatLng = {
        latitude: c.center_latitude,
        longitude: c.center_longitude,
      };

      // Cek jarak terdekat ke setiap segmen rute
      let minDistance = Infinity;
      for (let i = 0; i < routeCoords.length - 1; i++) {
        const dist = distanceToSegmentMeters(
          clusterPos,
          routeCoords[i],
          routeCoords[i + 1]
        );
        if (dist < minDistance) {
          minDistance = dist;
          if (minDistance <= bufferMeters) break; // Early exit jika sudah masuk koridor
        }
      }

      if (minDistance <= bufferMeters) {
        matchedClusters.push(c);
        if (c.severity === 'severe') severeCount++;
        else if (c.severity === 'high') highCount++;
        else if (c.severity === 'medium') mediumCount++;
        else lowCount++;
      }
    }

    const totalHazards = matchedClusters.length;
    const distanceKm = Math.max(0.5, distanceMeters / 1000);
    const density = Math.round((totalHazards / distanceKm) * 10) / 10;

    let safetyRating: 'safe' | 'caution' | 'dangerous' = 'safe';
    let safetyLabel = 'Kondisi Jalan Mulus';

    if (severeCount > 0 || density >= 3.0) {
      safetyRating = 'dangerous';
      safetyLabel = `Jalur Rawan (${totalHazards} titik, ${severeCount} severe)`;
    } else if (highCount > 0 || totalHazards > 0) {
      safetyRating = 'caution';
      safetyLabel = `Waspada Guncangan (${totalHazards} titik jalan)`;
    }

    return {
      totalHazards,
      severeCount,
      highCount,
      mediumCount,
      lowCount,
      hazardsAlongRoute: matchedClusters,
      hazardDensityPerKm: density,
      safetyRating,
      safetyLabel,
    };
  },
};
