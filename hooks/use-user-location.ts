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
 * Global cache lokasi terakhir perangkat (persistent antar pergantian tab/layar).
 * Menghilangkan delay 2–5 detik saat berpindah dari halaman utama ke ride mode.
 */
let cachedLocation: {
  coords: LatLng;
  accuracy: number | null;
  speedKmh: number;
  timestampMs: number;
} | null = null;

/**
 * Low-pass EMA filter untuk kecepatan GPS.
 */
const SPEED_EMA_ALPHA = 0.25;

/**
 * Haversine distance antara dua koordinat (meter).
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
  // Inisialisasi langsung dari cache modul agar tidak ada delay awal (0 ms)
  const [state, setState] = useState<UserLocationState>({
    coords: cachedLocation ? cachedLocation.coords : null,
    accuracy: cachedLocation ? cachedLocation.accuracy : null,
    speedKmh: cachedLocation ? cachedLocation.speedKmh : 0,
    rawSpeedKmh: cachedLocation ? cachedLocation.speedKmh : 0,
    routeHistory: cachedLocation ? [cachedLocation.coords] : [],
    isTracking: false,
    permissionGranted: cachedLocation != null,
    errorMsg: null,
  });

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const emaSpeedRef = useRef<number>(cachedLocation?.speedKmh ?? 0);
  const lastLocRef = useRef<{ coords: LatLng; timeMs: number } | null>(
    cachedLocation
      ? { coords: cachedLocation.coords, timeMs: cachedLocation.timestampMs }
      : null
  );

  // Ambil lokasi instan sekali (memanfaatkan fast cache OS + GPS akurasi tinggi)
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

      // 1. Ambil lokasi terakhir dari cache OS instan (0-20ms)
      const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
      if (lastKnown) {
        const fastCoords: LatLng = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        const rawKmh =
          lastKnown.coords.speed != null && lastKnown.coords.speed >= 0
            ? lastKnown.coords.speed * 3.6
            : 0;

        cachedLocation = {
          coords: fastCoords,
          accuracy: lastKnown.coords.accuracy,
          speedKmh: rawKmh,
          timestampMs: lastKnown.timestamp,
        };

        setState((prev) => ({
          ...prev,
          coords: fastCoords,
          accuracy: lastKnown.coords.accuracy,
          rawSpeedKmh: rawKmh,
          speedKmh: rawKmh,
          permissionGranted: true,
          errorMsg: null,
          routeHistory:
            prev.routeHistory.length === 0 ? [fastCoords] : prev.routeHistory,
        }));
      }

      // 2. Refresh dengan pembacaan satelit GPS akurasi tinggi
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords: LatLng = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      const rawKmh =
        loc.coords.speed != null && loc.coords.speed >= 0
          ? loc.coords.speed * 3.6
          : 0;

      cachedLocation = {
        coords,
        accuracy: loc.coords.accuracy,
        speedKmh: rawKmh,
        timestampMs: loc.timestamp,
      };

      setState((prev) => ({
        ...prev,
        coords,
        accuracy: loc.coords.accuracy,
        rawSpeedKmh: rawKmh,
        speedKmh: rawKmh,
        permissionGranted: true,
        errorMsg: null,
        routeHistory:
          prev.routeHistory.length === 0 ? [coords] : prev.routeHistory,
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

      // Pastikan ada posisi awal cepat sebelum watchPosition mengirim update pertama
      if (!cachedLocation) {
        const quick = await Location.getLastKnownPositionAsync().catch(() => null);
        if (quick) {
          const qCoords: LatLng = {
            latitude: quick.coords.latitude,
            longitude: quick.coords.longitude,
          };
          cachedLocation = {
            coords: qCoords,
            accuracy: quick.coords.accuracy,
            speedKmh: 0,
            timestampMs: quick.timestamp,
          };
          setState((prev) => ({
            ...prev,
            coords: qCoords,
            permissionGranted: true,
            routeHistory:
              prev.routeHistory.length === 0 ? [qCoords] : prev.routeHistory,
          }));
        }
      }

      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 2, // Update setiap perpindahan 2 meter
          timeInterval: 1000, // atau setiap 1 detik
        },
        (loc) => {
          const currentCoords: LatLng = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          const nowMs = loc.timestamp;

          // ── Kecepatan dari GPS ─────────────────────────────────────────────
          let rawKmh =
            loc.coords.speed != null && loc.coords.speed >= 0
              ? loc.coords.speed * 3.6
              : -1;

          // ── Fallback jarak/waktu jika kecepatan GPS tidak tersedia ─────────
          if (rawKmh < 0 && lastLocRef.current) {
            const dt = (nowMs - lastLocRef.current.timeMs) / 1000;
            if (dt > 0) {
              const distM = haversineMeters(
                lastLocRef.current.coords,
                currentCoords
              );
              rawKmh = (distM / dt) * 3.6;
            } else {
              rawKmh = 0;
            }
          } else if (rawKmh < 0) {
            rawKmh = 0;
          }

          // ── Sanity check: reject lonjakan glitch GPS ───────────────────────
          const maxGlitch = options?.maxSpeedGlitch ?? 200;
          if (rawKmh > maxGlitch) {
            rawKmh = emaSpeedRef.current;
          }

          // ── EMA low-pass filter kecepatan ─────────────────────────────────
          const alpha = options?.speedEmaAlpha ?? SPEED_EMA_ALPHA;
          emaSpeedRef.current =
            alpha * rawKmh + (1 - alpha) * emaSpeedRef.current;

          const filteredKmh = Math.max(0, emaSpeedRef.current);

          // Update lastLoc & global cache
          lastLocRef.current = { coords: currentCoords, timeMs: nowMs };
          cachedLocation = {
            coords: currentCoords,
            accuracy: loc.coords.accuracy,
            speedKmh: filteredKmh,
            timestampMs: nowMs,
          };

          setState((prev) => {
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
  }, [options?.maxSpeedGlitch, options?.speedEmaAlpha]);

  const stopTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    emaSpeedRef.current = 0;
    lastLocRef.current = null;
    setState((prev) => ({
      ...prev,
      isTracking: false,
      speedKmh: 0,
      rawSpeedKmh: 0,
    }));
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
