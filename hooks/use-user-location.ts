import { useEffect, useState, useRef, useCallback } from "react";
import * as Location from "expo-location";
import type { LatLng } from "@/components/map/map-data";

export interface UserLocationState {
  coords: LatLng | null;
  accuracy: number | null;
  speedKmh: number;
  routeHistory: LatLng[];
  isTracking: boolean;
  permissionGranted: boolean;
  errorMsg: string | null;
}

export function useUserLocation(autoStartTracking = false) {
  const [state, setState] = useState<UserLocationState>({
    coords: null,
    accuracy: null,
    speedKmh: 0,
    routeHistory: [],
    isTracking: false,
    permissionGranted: false,
    errorMsg: null,
  });

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Ambil lokasi instan sekali
  const getImmediateLocation = useCallback(async (): Promise<LatLng | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState((prev) => ({
          ...prev,
          permissionGranted: false,
          errorMsg: "Izin lokasi tidak diberikan oleh pengguna",
        }));
        return null;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newCoords: LatLng = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      setState((prev) => ({
        ...prev,
        coords: newCoords,
        accuracy: loc.coords.accuracy,
        speedKmh: loc.coords.speed ? Math.max(0, loc.coords.speed * 3.6) : 0,
        permissionGranted: true,
        errorMsg: null,
      }));

      return newCoords;
    } catch (err: any) {
      console.warn("[useUserLocation] Gagal mengambil lokasi:", err);
      setState((prev) => ({
        ...prev,
        errorMsg: err.message || "Gagal memperoleh koordinat GPS",
      }));
      return null;
    }
  }, []);

  // Mulai live tracking pergerakan GPS
  const startTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState((prev) => ({
          ...prev,
          permissionGranted: false,
          errorMsg: "Izin lokasi diperlukan untuk tracking rute berkendara",
        }));
        return;
      }

      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 4, // Rekam setiap perpindahan 4 meter
          timeInterval: 1500, // atau setiap 1.5 detik
        },
        (loc) => {
          const currentPoint: LatLng = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          const kmh = loc.coords.speed ? Math.max(0, loc.coords.speed * 3.6) : 0;

          setState((prev) => {
            // Hindari duplikasi koordinat yang sama persis
            const last = prev.routeHistory[prev.routeHistory.length - 1];
            const isDifferent =
              !last ||
              Math.abs(last.latitude - currentPoint.latitude) > 0.00003 ||
              Math.abs(last.longitude - currentPoint.longitude) > 0.00003;

            return {
              ...prev,
              coords: currentPoint,
              accuracy: loc.coords.accuracy,
              speedKmh: kmh,
              isTracking: true,
              permissionGranted: true,
              routeHistory: isDifferent
                ? [...prev.routeHistory, currentPoint]
                : prev.routeHistory,
            };
          });
        }
      );

      setState((prev) => ({ ...prev, isTracking: true }));
    } catch (err: any) {
      console.warn("[useUserLocation] Gagal memulai watchPosition:", err);
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  const clearRouteHistory = useCallback(() => {
    setState((prev) => ({ ...prev, routeHistory: [] }));
  }, []);

  useEffect(() => {
    getImmediateLocation();

    if (autoStartTracking) {
      startTracking();
    }

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
