import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LatLng } from '@/components/map/map-data';

const TRIP_STORAGE_KEY = 'HYPERGRID_SAVED_TRIPS_V1';
const MAX_SAVED_TRIPS = 200;

export interface SavedTripRecord {
  id: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  elapsedSeconds: number;
  distanceMeters: number;
  maxGForce: number;
  anomalyCount: number;
  vehicleName?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  startLocationName: string;
  destinationName: string;
  startCoords?: LatLng | null;
  destinationCoords?: LatLng | null;
  roadScore: number;
  isTflite?: boolean;
  confidencePercent?: number;
  confidenceTier?: string;
}

let tripMemoryCache: SavedTripRecord[] | null = null;
type TripListener = (trips: SavedTripRecord[]) => void;
const tripListeners = new Set<TripListener>();

function notifyTripListeners(trips: SavedTripRecord[]) {
  tripListeners.forEach((fn) => {
    try {
      fn(trips);
    } catch {
      // Ignore listener error
    }
  });
}

export const tripStorage = {
  /**
   * Mengambil snapshot cache perjalanan dari memori secara sinkron (0 ms).
   */
  getMemoryCache(): SavedTripRecord[] | null {
    return tripMemoryCache;
  },

  /**
   * Berlangganan perubahan data riwayat perjalanan secara reaktif.
   */
  subscribe(listener: TripListener): () => void {
    tripListeners.add(listener);
    return () => {
      tripListeners.delete(listener);
    };
  },

  /**
   * Mengambil seluruh riwayat perjalanan yang tersimpan di HP.
   */
  async getTrips(): Promise<SavedTripRecord[]> {
    if (tripMemoryCache !== null) {
      return tripMemoryCache;
    }
    try {
      const raw = await AsyncStorage.getItem(TRIP_STORAGE_KEY);
      if (!raw) {
        tripMemoryCache = [];
        return [];
      }
      const parsed = JSON.parse(raw);
      const list: SavedTripRecord[] = Array.isArray(parsed) ? parsed : [];
      tripMemoryCache = list;
      notifyTripListeners(list);
      return list;
    } catch (err) {
      console.warn('[TripStorage] Gagal membaca riwayat perjalanan:', err);
      return tripMemoryCache ?? [];
    }
  },

  /**
   * Menyimpan sesi perjalanan yang baru selesai.
   */
  async saveTrip(record: SavedTripRecord): Promise<SavedTripRecord[]> {
    try {
      const existing = tripMemoryCache ?? (await this.getTrips());
      const filtered = existing.filter((t) => t.id !== record.id);
      const updated = [record, ...filtered].slice(0, MAX_SAVED_TRIPS);
      tripMemoryCache = updated;
      notifyTripListeners(updated);
      await AsyncStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (err) {
      console.warn('[TripStorage] Gagal menyimpan sesi perjalanan:', err);
      return tripMemoryCache ?? [record];
    }
  },

  /**
   * Hapus riwayat perjalanan lokal (misal saat logout).
   */
  async clear(): Promise<void> {
    try {
      tripMemoryCache = [];
      notifyTripListeners([]);
      await AsyncStorage.removeItem(TRIP_STORAGE_KEY);
    } catch (err) {
      console.warn('[TripStorage] Gagal menghapus riwayat perjalanan:', err);
    }
  },
};

// Warm-up cache di background
tripStorage.getTrips().catch(() => {});
