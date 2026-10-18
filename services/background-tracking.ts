import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { LatLng } from '@/components/map/map-data';
import { offlineQueue } from '@/services/api/offline-queue';

export const BACKGROUND_LOCATION_TASK = 'HYPERGRID_BACKGROUND_LOCATION_TASK';

export type BackgroundTrackingMode = 'disabled' | 'idle' | 'driving';

export interface BackgroundLocationPayload {
  coords: LatLng;
  accuracy: number | null;
  speedKmh: number;
  timestamp: number;
  mode: BackgroundTrackingMode;
}

export interface CachedLocationData {
  coords: LatLng;
  accuracy: number | null;
  speedKmh: number;
  timestampMs: number;
}

let cachedLocation: CachedLocationData | null = null;

export function updateCachedLocation(data: CachedLocationData): void {
  cachedLocation = data;
}

export function getCachedLocation(): CachedLocationData | null {
  return cachedLocation;
}

type LocationListener = (payload: BackgroundLocationPayload) => void;
type StatusListener = (mode: BackgroundTrackingMode) => void;

class BackgroundTrackingService {
  private currentMode: BackgroundTrackingMode = 'disabled';
  private locationListeners = new Set<LocationListener>();
  private statusListeners = new Set<StatusListener>();
  private lastFlushTimestamp = 0;

  constructor() {
    // Registrasi task manager hanya pada native (Android/iOS)
    if (Platform.OS !== 'web') {
      this.registerBackgroundTask();
    }
  }

  /**
   * Mendaftarkan headless background task ke TaskManager.
   * Harus dipanggil pada root / module scope.
   */
  private registerBackgroundTask() {
    if (TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
      return;
    }

    TaskManager.defineTask(
      BACKGROUND_LOCATION_TASK,
      async ({ data, error }) => {
        if (error) {
          console.warn('[BackgroundTracking] Error pada background task:', error);
          return;
        }

        if (!data) return;

        const { locations } = data as { locations: Location.LocationObject[] };
        if (!locations || locations.length === 0) return;

        // Ambil lokasi terbaru dari payload update
        const latestLoc = locations[locations.length - 1];
        const coords: LatLng = {
          latitude: latestLoc.coords.latitude,
          longitude: latestLoc.coords.longitude,
        };

        const speedKmh =
          latestLoc.coords.speed != null && latestLoc.coords.speed >= 0
            ? latestLoc.coords.speed * 3.6
            : 0;

        const payload: BackgroundLocationPayload = {
          coords,
          accuracy: latestLoc.coords.accuracy,
          speedKmh,
          timestamp: latestLoc.timestamp,
          mode: this.currentMode,
        };

        // 1. Perbarui cache lokasi modul
        updateCachedLocation({
          coords,
          accuracy: latestLoc.coords.accuracy,
          speedKmh,
          timestampMs: latestLoc.timestamp,
        });

        // 2. Broadcast ke semua listener aktif di memori
        this.notifyLocationListeners(payload);

        // 3. Periodic Flush Offline Queue saat berjalan di background (setiap 30 detik)
        const now = Date.now();
        if (now - this.lastFlushTimestamp > 30_000 && offlineQueue.size() > 0) {
          this.lastFlushTimestamp = now;
          try {
            await offlineQueue.flush();
          } catch (e) {
            console.warn('[BackgroundTracking] Gagal background flush:', e);
          }
        }
      }
    );
  }

  /**
   * Menambahkan listener event lokasi background
   */
  public addLocationListener(listener: LocationListener): () => void {
    this.locationListeners.add(listener);
    return () => {
      this.locationListeners.delete(listener);
    };
  }

  /**
   * Menambahkan listener perubahan mode background
   */
  public addStatusListener(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyLocationListeners(payload: BackgroundLocationPayload) {
    for (const listener of this.locationListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.warn('[BackgroundTracking] Listener error:', err);
      }
    }
  }

  private notifyStatusListeners(mode: BackgroundTrackingMode) {
    for (const listener of this.statusListeners) {
      try {
        listener(mode);
      } catch (err) {
        console.warn('[BackgroundTracking] Status listener error:', err);
      }
    }
  }

  /**
   * Memulai background tracking untuk mode 'driving' atau 'idle'.
   */
  public async startBackgroundTracking(
    mode: 'driving' | 'idle'
  ): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    try {
      // 1. Minta izin lokasi foreground jika belum diizinkan
      const fgStatus = await Location.requestForegroundPermissionsAsync();
      if (fgStatus.status !== 'granted') {
        console.warn('[BackgroundTracking] Izin lokasi foreground ditolak');
        return false;
      }

      // 2. Minta izin lokasi background (opsional tapi disarankan)
      try {
        await Location.requestBackgroundPermissionsAsync();
      } catch (bgErr) {
        console.warn('[BackgroundTracking] Request background permission warn:', bgErr);
      }

      // 3. Hentikan task lama jika sedang berjalan agar opsi baru diterapkan
      const isAlreadyStarted = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK
      ).catch(() => false);

      if (isAlreadyStarted) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(
          () => {}
        );
      }

      // 4. Konfigurasi task sesuai mode (driving vs idle)
      const options: Location.LocationTaskOptions =
        mode === 'driving'
          ? {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 1000, // Update per 1 detik
              distanceInterval: 2, // Update per perpindahan 2 meter
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: 'HyperGrid Drive Tracking Active',
                notificationBody:
                  'Monitoring road quality & recording telemetry in real-time',
                notificationColor: '#0F172A',
              },
              pausesUpdatesAutomatically: false,
              activityType: Location.ActivityType.AutomotiveNavigation,
            }
          : {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 10000, // Update per 10 detik saat idle
              distanceInterval: 15, // Update per 15 meter saat idle
              showsBackgroundLocationIndicator: false,
              foregroundService: {
                notificationTitle: 'HyperGrid Standby Active',
                notificationBody:
                  'Road condition standby monitoring active in background',
                notificationColor: '#334155',
              },
              pausesUpdatesAutomatically: true,
              activityType: Location.ActivityType.Other,
            };

      await Location.startLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK,
        options
      );

      this.currentMode = mode;
      this.notifyStatusListeners(mode);
      return true;
    } catch (error) {
      console.warn(`[BackgroundTracking] Gagal memulai mode ${mode}:`, error);
      return false;
    }
  }

  /**
   * Menghentikan background tracking
   */
  public async stopBackgroundTracking(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK
      ).catch(() => false);

      if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
      this.currentMode = 'disabled';
      this.notifyStatusListeners('disabled');
    } catch (err) {
      console.warn('[BackgroundTracking] Gagal menghentikan tracking:', err);
    }
  }

  /**
   * Mengambil status tracking saat ini
   */
  public async getStatus(): Promise<{
    isRunning: boolean;
    mode: BackgroundTrackingMode;
  }> {
    if (Platform.OS === 'web') {
      return { isRunning: false, mode: 'disabled' };
    }

    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK
    ).catch(() => false);

    return {
      isRunning,
      mode: isRunning ? this.currentMode : 'disabled',
    };
  }

  public getMode(): BackgroundTrackingMode {
    return this.currentMode;
  }
}

export const backgroundTrackingService = new BackgroundTrackingService();
