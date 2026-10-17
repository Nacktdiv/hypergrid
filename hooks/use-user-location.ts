import { useEffect, useState, useRef, useCallback } from "react";
import * as Location from "expo-location";
import type { LatLng } from "@/components/map/map-data";

export interface UserLocationState {
  coords: LatLng | null;
  accuracy: number | null;
  /** Kecepatan yang telah difilter dengan low-pass EMA (km/h) */
  speedKmh: number;
  /** Kecepatan mentah GPS sebelum filter (km/h) */
  rawSpeedKmh: number;
  routeHistory: LatLng[];
  isTracking: boolean;
  permissionGranted: boolean;
  errorMsg: string | null;
}

/**
 * Low-pass EMA filter untuk kecepatan GPS.
 * α kecil = lebih halus (lambat reaksi), α besar = lebih responsif.
 * α = 0.25 cocok untuk update 1–2 Hz agar noise GPS tidak terasa.
 */
const SPEED_EMA_ALPHA = 0.25;

/**
 * Haversine distance antara dua koordinat (meter).
 * Digunakan sebagai cross-check untuk deteksi GPS glitch.
 */
function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const hav =
    sinLat * sinLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

export function useUserLocation(
  autoStartTracking = false,
  options?: { speedEmaAlpha?: number; maxSpeedGlitch?: number }
) {
  const [state, setState] = useState<UserLocationState>({
    coords: null,
    accuracy: null,
    speedKmh: 0,
    rawSpeedKmh: 0,
    routeHistory: [],
    isTracking: false,
    permissionGranted: false,
    errorMsg: null,
  });

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const emaSpeedRef = useRef<number>(0);   // EMA state yang persisten antar update
  const lastLocRef  = useRef<{ coords: LatLng; timeMs: number } | null>(null);

  // Ambil lokasi instan sekali (non-tracking)
  const getImmediateLocation = useCallback(async (): Promise<LatLng | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState((prev) => ({
          ...prev,
          permissionGranted: false,
          errorMsg: "Location permission not granted.",
        }));
        return null;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords: LatLng = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      const rawKmh = loc.coords.speed != null && loc.coords.speed >= 0
        ? loc.coords.speed * 3.6
        : 0;

      setState((prev) => ({
        ...prev,
        coords,
        accuracy: loc.coords.accuracy,
        rawSpeedKmh: rawKmh,
        speedKmh: rawKmh,
        permissionGranted: true,
        errorMsg: null,
      }));

      return coords;
    } catch (err: any) {
      console.warn("[useUserLocation] Failed to get location:", err);
      setState((prev) => ({
        ...prev,
        errorMsg: err.message || "Failed to get GPS coordinates.",
      }));
      return null;
    }
  }, []);

  // Mulai live tracking GPS dengan akurasi tinggi + filter EMA kecepatan
  const startTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState((prev) => ({
          ...prev,
          permissionGranted: false,
          errorMsg: "Location permission required for ride tracking.",
        }));
        return;
      }

      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 2,   // Update setiap perpindahan 2 meter
          timeInterval: 1000,    // atau setiap 1 detik
        },
        (loc) => {
          const currentCoords: LatLng = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          const nowMs = loc.timestamp;

          // ── Kecepatan dari GPS ─────────────────────────────────────────────
          let rawKmh = loc.coords.speed != null && loc.coords.speed >= 0
            ? loc.coords.speed * 3.6
            : -1; // -1 berarti GPS tidak memberikan data kecepatan

          // ── Fallback: hitung kecepatan dari jarak/waktu jika GPS speed tidak ada ──
          if (rawKmh < 0 && lastLocRef.current) {
            const dt = (nowMs - lastLocRef.current.timeMs) / 1000; // detik
            if (dt > 0) {
              const distM = haversineMeters(lastLocRef.current.coords, currentCoords);
              rawKmh = (distM / dt) * 3.6; // m/s → km/h
            } else {
              rawKmh = 0;
            }
          } else if (rawKmh < 0) {
            rawKmh = 0;
          }

          // ── Sanity check: reject GPS glitch sesuai profil kendaraan ──
          const maxGlitch = options?.maxSpeedGlitch ?? 200;
          if (rawKmh > maxGlitch) {
            rawKmh = emaSpeedRef.current; // gunakan nilai EMA terakhir
          }

          // ── EMA low-pass filter (responsif sesuai dinamika kendaraan) ─────────
          const alpha = options?.speedEmaAlpha ?? SPEED_EMA_ALPHA;
          emaSpeedRef.current =
            alpha * rawKmh + (1 - alpha) * emaSpeedRef.current;

          const filteredKmh = Math.max(0, emaSpeedRef.current);

          // Update lastLoc untuk hitung fallback berikutnya
          lastLocRef.current = { coords: currentCoords, timeMs: nowMs };

          setState((prev) => {
            // Hindari duplikasi koordinat yang sama persis
            const last = prev.routeHistory[prev.routeHistory.length - 1];
            const isDifferent =
              !last ||
              Math.abs(last.latitude - currentCoords.latitude) > 0.00002 ||
              Math.abs(last.longitude - currentCoords.longitude) > 0.00002;

            return {
              ...prev,
              coords: currentCoords,
              accuracy: loc.coords.accuracy,
              rawSpeedKmh: Math.round(rawKmh * 10) / 10,
              speedKmh: Math.round(filteredKmh * 10) / 10,
              isTracking: true,
              permissionGranted: true,
              routeHistory: isDifferent
                ? [...prev.routeHistory, currentCoords]
                : prev.routeHistory,
            };
          });
        }
      );

      setState((prev) => ({ ...prev, isTracking: true }));
    } catch (err: any) {
      console.warn("[useUserLocation] Failed to start watchPosition:", err);
      setState((prev) => ({
        ...prev,
        errorMsg: err.message || "Failed to start GPS tracking.",
      }));
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    emaSpeedRef.current = 0;
    lastLocRef.current = null;
    setState((prev) => ({ ...prev, isTracking: false, speedKmh: 0, rawSpeedKmh: 0 }));
  }, []);

  const clearRouteHistory = useCallback(() => {
    setState((prev) => ({ ...prev, routeHistory: [] }));
  }, []);

  useEffect(() => {
    getImmediateLocation();
    if (autoStartTracking) startTracking();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [autoStartTracking, getImmediateLocation, startTracking]);

  return {
    ...state,
    getImmediateLocation,
    startTracking,
    stopTracking,
    clearRouteHistory,
  };
}
