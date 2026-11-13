import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { BackHandler, InteractionManager, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Accelerometer, Gyroscope } from "expo-sensors";

import { BottomHud, type ShockAlert } from "@/components/ride/bottom-hud";
import { LiveMap } from "@/components/ride/live-map";
import { TopFloatingBar } from "@/components/ride/top-floating-bar";
import { TripCompletedView } from "@/components/ride/trip-completed-view";
import { EmergencyModal } from "@/components/ui/emergency-modal";
import { useAppTheme } from "@/contexts/theme-context";
import { useVehicle } from "@/contexts/vehicle-context";
import { EDGE_AI_CONFIG } from "@/edge-ai/model-config";
import type { RawSensorSample } from "@/edge-ai/types";
import { defaultEdgeDetector } from "@/edge-ai/detector";
import { HighPassFilter } from "@/edge-ai/high-pass-filter";
import { useAuth } from "@/hooks/use-auth";
import { useDetections } from "@/hooks/use-detections";
import { useEdgeAi } from "@/hooks/use-edge-ai";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";
import { useUserLocation } from "@/hooks/use-user-location";
import { offlineQueue } from "@/services/api/offline-queue";
import { tokenStorage } from "@/services/api/token-storage";
import { backgroundTrackingService } from "@/services/background-tracking";
import { routingService } from "@/services/api/routing.service";
import { tripStorage, type SavedTripRecord } from "@/services/api/trip-storage";
import type { DamagePoint, LatLng } from "@/components/map/map-data";

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

/**
 * Start Drive Mode (Live Tracking HUD).
 */
export default function RideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    destinationName?: string;
    destinationLat?: string;
    destinationLon?: string;
    routeCoords?: string;
    distanceMeters?: string;
    durationSeconds?: string;
  }>();

  // Mempertahankan status tujuan perjalanan & rute navigasi terarah
  const destination = useMemo(() => {
    if (params.destinationName && params.destinationLat && params.destinationLon) {
      let planned: LatLng[] = [];
      try {
        if (params.routeCoords) planned = JSON.parse(params.routeCoords);
      } catch {}
      return {
        name: params.destinationName,
        coords: {
          latitude: parseFloat(params.destinationLat),
          longitude: parseFloat(params.destinationLon),
        },
        plannedRoute: planned,
      };
    }
    return null;
  }, [params.destinationName, params.destinationLat, params.destinationLon, params.routeCoords]);

  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { vehicleProfile } = useVehicle();
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isEmergencyVisible, setIsEmergencyVisible] = useState(false);
  const [resolvedDestinationName, setResolvedDestinationName] = useState<string>(
    destination?.name || ""
  );

  const startCoordsRef = useRef<LatLng | null>(null);
  const [startLocationName, setStartLocationName] = useState<string>("Origin Location");
  const [tripStartTime] = useState<number>(() => Date.now());

  useEffect(() => {
    defaultEdgeDetector.setUserId(user?.id ?? null);
  }, [user]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      backgroundTrackingService.startBackgroundTracking("driving").catch((err) => {
        console.warn("[RideScreen] Gagal mengaktifkan background driving tracking:", err);
      });
    });

    return () => {
      task.cancel();
      backgroundTrackingService.stopBackgroundTracking().catch(() => {});
    };
  }, []);

  // Status Telemetri Live
  const [currentVibration, setCurrentVibration] = useState(0);
  const [shockLevel, setShockLevel] = useState(0);
  const [activeShockAlert, setActiveShockAlert] = useState<ShockAlert | null>(null);
  const shockAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liveDetections, setLiveDetections] = useState<DamagePoint[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [maxGForce, setMaxGForce] = useState<number>(0);

  const triggerShockAlert = useCallback(
    (alert: ShockAlert, autoDismissMs = 6000) => {
      if (shockAlertTimerRef.current) {
        clearTimeout(shockAlertTimerRef.current);
      }
      setActiveShockAlert(alert);
      if (autoDismissMs > 0) {
        shockAlertTimerRef.current = setTimeout(() => {
          setActiveShockAlert(null);
        }, autoDismissMs);
      }
    },
    []
  );

  const handleDismissShockAlert = useCallback(() => {
    if (shockAlertTimerRef.current) {
      clearTimeout(shockAlertTimerRef.current);
    }
    setActiveShockAlert(null);
  }, []);

  useEffect(() => {
    return () => {
      if (shockAlertTimerRef.current) {
        clearTimeout(shockAlertTimerRef.current);
      }
    };
  }, []);

  // Timer durasi berkendara
  useEffect(() => {
    if (isPaused || isFinished) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, isFinished]);

  // Status Sensor Akselerometer & Giroskop HP
  const [sensorEnabled] = useState(true);
  const [liveGForce, setLiveGForce] = useState<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);

  // Ref penampung data Giroskop real-time
  const gyroRef = useRef<{ gx: number; gy: number; gz: number }>({
    gx: 0,
    gy: 0,
    gz: 0,
  });

  // Ref tracking vektor gravitasi 3D dinamis (invarian orientasi HP)
  const gravityRef = useRef<{
    gx: number;
    gy: number;
    gz: number;
    initialized: boolean;
  }>({
    gx: 0,
    gy: 0,
    gz: 1,
    initialized: false,
  });

  // Ref Digital High-Pass Filter (HPF 1.2 Hz @ 20 Hz) untuk eliminasi ayunan suspensi & kontur jalan
  const hpfRef = useRef(new HighPassFilter(1.2, 20));

  // GPS Live Tracking Perjalanan dengan parameter adaptif per kendaraan
  const {
    coords: liveCoords,
    speedKmh: gpsSpeed,
    routeHistory,
    stopTracking,
  } = useUserLocation(true, {
    speedEmaAlpha: vehicleProfile.sensorConfig.speedEmaAlpha,
    maxSpeedGlitch: vehicleProfile.sensorConfig.maxSpeedGlitch,
  });

  // Mutable refs agar listener sensor tidak perlu re-subscribe setiap tick GPS (mencegah memory leak)
  const liveCoordsRef = useRef<LatLng | null>(liveCoords);
  const gpsSpeedRef = useRef<number>(gpsSpeed);
  const vehicleProfileRef = useRef(vehicleProfile);
  const lastUiUpdateRef = useRef<number>(0);
  const windowPeakTotalGRef = useRef<number>(0);
  const windowPeakDynamicGRef = useRef<number>(0);
  const windowPeakVibRef = useRef<number>(0);
  const windowPeakShockLevelRef = useRef<number>(0);
  const lastMotionAtRef = useRef<number>(0);

  useEffect(() => {
    liveCoordsRef.current = liveCoords;
    gpsSpeedRef.current = gpsSpeed;
    vehicleProfileRef.current = vehicleProfile;
  }, [liveCoords, gpsSpeed, vehicleProfile]);

  // Simpan koordinat awal dan deteksi nama lokasi keberangkatan di background
  useEffect(() => {
    if (liveCoords && !startCoordsRef.current) {
      startCoordsRef.current = liveCoords;
      routingService
        .reverseGeocode(liveCoords)
        .then((name) => {
          if (name) setStartLocationName(name);
        })
        .catch(() => {});
    }
  }, [liveCoords]);

  // Jarak tersisa live ke lokasi tujuan terarah (diperbarui secara akurat setiap GPS tick)
  const remainingDistanceMeters = useMemo(() => {
    if (!destination?.coords || !liveCoords) return null;
    return haversineMeters(liveCoords, destination.coords);
  }, [destination, liveCoords]);

  // Kecepatan spidometer terkalibrasi secara dinamis sesuai profil kendaraan
  const currentSpeed = useMemo(() => {
    if (isPaused || isFinished) return 0;
    const minSpeed = vehicleProfile.sensorConfig.minMovingSpeed ?? 2.0;
    const displayFactor = vehicleProfile.sensorConfig.speedDisplayFactor ?? 1.0;

    if (gpsSpeed >= minSpeed) {
      return Math.round(gpsSpeed * displayFactor);
    }
    return 0;
  }, [gpsSpeed, isPaused, isFinished, vehicleProfile]);

  const totalDistanceMeters = useMemo(() => {
    if (!routeHistory || routeHistory.length < 2) return 0;
    let dist = 0;
    for (let i = 1; i < routeHistory.length; i++) {
      dist += haversineMeters(routeHistory[i - 1], routeHistory[i]);
    }
    return dist;
  }, [routeHistory]);

  // Hook Edge AI, Klaster PostGIS, dan Deteksi History
  const {
    detectedCount,
    lastResult,
    addSample,
    runInference,
  } = useEdgeAi();

  const runInferenceRef = useRef(runInference);
  const addSampleRef = useRef(addSample);
  const maxGForceRef = useRef(maxGForce);
  const liveGForceRef = useRef(liveGForce);
  const detectedCountRef = useRef(detectedCount);
  const lastResultRef = useRef(lastResult);
  const hasSavedSessionRef = useRef(false);

  useEffect(() => {
    runInferenceRef.current = runInference;
    addSampleRef.current = addSample;
    maxGForceRef.current = maxGForce;
    liveGForceRef.current = liveGForce;
    detectedCountRef.current = detectedCount;
    lastResultRef.current = lastResult;
  }, [runInference, addSample, maxGForce, liveGForce, detectedCount, lastResult]);

  const { clusters, nearbyCluster, fetchClusters, checkNearby } =
    usePotholeClusters();
  const { detections: recordedDetections, fetchDetections } = useDetections();
  const fetchClustersRef = useRef(fetchClusters);

  useEffect(() => {
    fetchClustersRef.current = fetchClusters;
  }, [fetchClusters]);

  // Muat seluruh klaster jalan dan titik history setelah animasi transisi masuk selesai
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const deviceId = await tokenStorage.getDeviceId();
        await Promise.allSettled([
          fetchClusters({ limit: 500 }),
          fetchDetections({
            limit: 150,
            userId: user?.id,
            deviceId: !user?.id ? deviceId : undefined,
          }),
        ]);
      } catch (err) {
        console.warn("[RideScreen] Gagal memuat klaster & history jalan:", err);
      }
    });
    return () => task.cancel();
  }, [fetchClusters, fetchDetections, user]);

  // Gabungkan titik klaster PostGIS, titik history yang terekam, dan deteksi baru saat live ride
  const allRoadHazards: DamagePoint[] = useMemo(() => {
    const pointsMap = new Map<string, DamagePoint>();

    // 1. Klaster lubang jalan di sekitar area jalan dari database PostGIS
    for (const c of clusters) {
      if (c.status === "repaired" || c.status === "false_positive") continue;
      if (
        typeof c.center_latitude !== "number" ||
        typeof c.center_longitude !== "number"
      ) {
        continue;
      }
      pointsMap.set(`cluster_${c.id}`, {
        id: c.id,
        position: {
          latitude: c.center_latitude,
          longitude: c.center_longitude,
        },
        severity: c.severity,
        reportCount: c.detection_count || 1,
      });
    }

    // 2. Titik-titik history deteksi anomali nyata yang telah terekam
    for (const d of recordedDetections) {
      if (typeof d.latitude !== "number" || typeof d.longitude !== "number") {
        continue;
      }
      if (user?.id && d.userId && d.userId !== user.id) continue;
      if (String(d.id).startsWith("ride_")) continue;
      if (typeof d.confidence === "number" && d.confidence <= 0) continue;
      if (typeof d.speedKmh === "number" && d.speedKmh < 1.5) continue;
      if (typeof d.zAccelPeak === "number" && d.zAccelPeak < 0.6) continue;

      const pos = { latitude: d.latitude, longitude: d.longitude };
      let alreadyCovered = false;
      for (const existing of pointsMap.values()) {
        if (haversineMeters(existing.position, pos) <= 12) {
          alreadyCovered = true;
          break;
        }
      }

      if (!alreadyCovered) {
        pointsMap.set(`hist_${d.id}`, {
          id: d.id,
          position: pos,
          severity:
            d.zAccelPeak && d.zAccelPeak >= 2.2
              ? "severe"
              : d.zAccelPeak && d.zAccelPeak >= 1.6
              ? "high"
              : d.zAccelPeak && d.zAccelPeak >= 1.1
              ? "medium"
              : "low",
          reportCount: 1,
        });
      }
    }

    // 3. Titik deteksi baru dari sesi live ride saat ini
    for (const pt of liveDetections) {
      pointsMap.set(pt.id, pt);
    }

    return Array.from(pointsMap.values());
  }, [clusters, recordedDetections, liveDetections, user]);

  // Loop Pemeriksaan Early Warning PostGIS Cluster di Sekitar Rute
  useEffect(() => {
    if (isPaused || isFinished) return;

    const earlyWarningTimer = setInterval(() => {
      const coords = liveCoordsRef.current;
      if (coords) {
        checkNearby(coords.latitude, coords.longitude, 25);
      }
    }, 2500);

    return () => clearInterval(earlyWarningTimer);
  }, [isPaused, isFinished, checkNearby]);

  // Gyroscope Listener — simpan angular velocity terbaru
  useEffect(() => {
    if (isPaused || isFinished || !sensorEnabled) return;

    Gyroscope.setUpdateInterval(EDGE_AI_CONFIG.sampleRateMs);

    const subscription = Gyroscope.addListener(({ x, y, z }) => {
      gyroRef.current = { gx: x, gy: y, gz: z };
    });

    return () => subscription.remove();
  }, [isPaused, isFinished, sensorEnabled]);

  // Accelerometer Listener + Causal EMA Gravity Removal + Buffer Window
  useEffect(() => {
    if (isPaused || isFinished || !sensorEnabled) return;

    Accelerometer.setUpdateInterval(EDGE_AI_CONFIG.sampleRateMs);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      // 1. Causal Gravity Tracking: filter arah gravitasi 1G sesungguhnya
      if (!gravityRef.current.initialized) {
        gravityRef.current = { gx: x, gy: y, gz: z, initialized: true };
      } else {
        const alpha = 0.08;
        gravityRef.current.gx = (1 - alpha) * gravityRef.current.gx + alpha * x;
        gravityRef.current.gy = (1 - alpha) * gravityRef.current.gy + alpha * y;
        gravityRef.current.gz = (1 - alpha) * gravityRef.current.gz + alpha * z;
      }

      const gNorm =
        Math.sqrt(
          gravityRef.current.gx * gravityRef.current.gx +
            gravityRef.current.gy * gravityRef.current.gy +
            gravityRef.current.gz * gravityRef.current.gz
        ) + 1e-6;
      const gUnitX = gravityRef.current.gx / gNorm;
      const gUnitY = gravityRef.current.gy / gNorm;
      const gUnitZ = gravityRef.current.gz / gNorm;

      // 2. Proyeksi akselerasi vertikal murni (sejajar gravitasi) dipadu High-Pass Filter (HPF)
      const aVert = x * gUnitX + y * gUnitY + z * gUnitZ;
      const aVertDiff = aVert - gNorm;
      // High-Pass Filter (1.8 Hz @ 20 Hz) menyaring tanjakan/turunan dan ayunan body-roll lambat
      const dynamicVerticalG = Math.abs(hpfRef.current.filter(aVertDiff));

      // Total magnitudo untuk tampilan display HUD
      const totalG = Math.sqrt(x * x + y * y + z * z);
      const roundedG = Math.round(totalG * 100) / 100;

      const currentProfile = vehicleProfileRef.current;
      const currentGpsSpeed = gpsSpeedRef.current;
      const minSpeed = currentProfile.sensorConfig.minMovingSpeed ?? 2.0;
      const now = Date.now();
      const isMovingNow = currentGpsSpeed >= minSpeed;

      if (isMovingNow) {
        lastMotionAtRef.current = now;
      }
      const hasRecentMotion =
        isMovingNow ||
        (lastMotionAtRef.current > 0 && now - lastMotionAtRef.current < 4000);

      // Telemetri gauge, vibrasi & G-Force aktif terus selama trip berjalan (terkalibrasi profil kendaraan)
      const computedLevel = Math.min(
        100,
        Math.max(
          8,
          Math.round(
            dynamicVerticalG * currentProfile.sensorConfig.shockGaugeMultiplier + 10
          )
        )
      );

      const idleVib = currentProfile.sensorConfig.idleVibration ?? 0;
      const rawDynamicVib = Math.round(
        (dynamicVerticalG * 9.81 * 2.8 + idleVib) *
          currentProfile.sensorConfig.vibrationFactor
      );
      const dynamicVib = Math.min(180, Math.max(idleVib, rawDynamicVib));

      // Peak-hold akumulator per sampel 50ms agar lonjakan lubang tajam tidak terbuang di antara tick UI
      if (roundedG > windowPeakTotalGRef.current) {
        windowPeakTotalGRef.current = roundedG;
      }
      if (dynamicVerticalG > windowPeakDynamicGRef.current) {
        windowPeakDynamicGRef.current = dynamicVerticalG;
      }
      if (dynamicVib > windowPeakVibRef.current) {
        windowPeakVibRef.current = dynamicVib;
      }
      if (computedLevel > windowPeakShockLevelRef.current) {
        windowPeakShockLevelRef.current = computedLevel;
      }

      // Flush peak window ke React state ~6.7 Hz (150ms) untuk HUD mulus & responsif
      if (now - lastUiUpdateRef.current >= 150) {
        lastUiUpdateRef.current = now;
        const peakG = windowPeakTotalGRef.current || roundedG;
        const peakLevel = windowPeakShockLevelRef.current || computedLevel;
        const peakVib = windowPeakVibRef.current || dynamicVib;

        windowPeakTotalGRef.current = 0;
        windowPeakDynamicGRef.current = 0;
        windowPeakShockLevelRef.current = 0;
        windowPeakVibRef.current = 0;

        setLiveGForce(peakG);
        setMaxGForce((prev) => Math.max(prev, peakG));
        setShockLevel(peakLevel);
        setCurrentVibration(peakVib);
      }

      const speedForSample = isMovingNow
        ? currentGpsSpeed
        : hasRecentMotion
        ? minSpeed
        : currentGpsSpeed;

      // Tambahkan ke rolling window buffer Edge AI (20 Hz)
      const sample: RawSensorSample = {
        ax: x,
        ay: y,
        az: z,
        gx: gyroRef.current.gx,
        gy: gyroRef.current.gy,
        gz: gyroRef.current.gz,
        speedKmh: speedForSample,
        timestampMs: now,
      };
      addSampleRef.current(sample);

      // Pre-filter Trigger evaluasi Edge AI
      const shockThreshold = currentProfile.sensorConfig.zShockThreshold;
      const maxSpikeLimit =
        currentProfile.sensorConfig.maxExtremeSpikeG ??
        EDGE_AI_CONFIG.maxExtremeSpikeG;
      const isCooldownPassed =
        now - lastDetectionTimeRef.current > EDGE_AI_CONFIG.detectionCooldownMs;

      // Filter artefak non-jalan: tolak lonjakan ekstrem (HP jatuh / terbanting)
      // dan perputaran liar giroskop (HP terlepas dari mount / dipegang tangan)
      const gyroMag = Math.sqrt(
        gyroRef.current.gx * gyroRef.current.gx +
          gyroRef.current.gy * gyroRef.current.gy +
          gyroRef.current.gz * gyroRef.current.gz
      );
      const isExtremeArtifact =
        dynamicVerticalG > maxSpikeLimit ||
        gyroMag > EDGE_AI_CONFIG.maxGyroTumbleRadPerSec;

      if (
        hasRecentMotion &&
        dynamicVerticalG >= shockThreshold &&
        !isExtremeArtifact &&
        isCooldownPassed
      ) {
        lastDetectionTimeRef.current = now;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

        triggerShockAlert({
          id: `shock_${now}`,
          title: `Road Shock Detected (${dynamicVerticalG.toFixed(2)}G)`,
          subtitle: "Analyzing road anomaly with Edge AI...",
          gForce: dynamicVerticalG,
          severity: dynamicVerticalG > 1.8 ? "danger" : "warning",
        });

        const coords = liveCoordsRef.current;
        if (!coords) {
          console.warn(
            "[RideScreen] GPS belum terkunci, inferensi deteksi lubang ditunda."
          );
          return;
        }

        const currentLat = coords.latitude;
        const currentLon = coords.longitude;

        runInferenceRef.current(
          { latitude: currentLat, longitude: currentLon },
          { offlineOnly: false },
          {
            ...currentProfile.sensorConfig,
            vehicleType: currentProfile.id,
          }
        )
          .then((res) => {
            if (res?.isAnomalyDetected) {
              const confPct = Math.round(res.confidence * 100);
              const isTflite =
                !res.modelVersion?.includes("fallback") &&
                !res.modelVersion?.includes("heuristic");

              triggerShockAlert({
                id: `det_${Date.now()}`,
                title: isTflite
                  ? `TFLite: ${Math.round(res.probability * 100)}% Pothole (${dynamicVerticalG.toFixed(2)}G)`
                  : `Pothole Detected (${confPct}% Conf · ${dynamicVerticalG.toFixed(2)}G)`,
                subtitle: "Road defect registered & logged",
                gForce: dynamicVerticalG,
                severity: dynamicVerticalG > 1.8 ? "danger" : "warning",
              });

              const newDamage: DamagePoint = {
                id: `det_${Date.now()}`,
                position: { latitude: currentLat, longitude: currentLon },
                severity: res.estimatedSeverity,
                reportCount: 1,
              };
              setLiveDetections((prev) => [...prev, newDamage]);
              fetchClustersRef.current({ limit: 500 }).catch(() => {});
            }
          })
          .catch((err: unknown) => {
            console.warn("[RideScreen] Error inferensi Edge AI:", err);
          });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [
    isPaused,
    isFinished,
    sensorEnabled,
    triggerShockAlert,
  ]);

  // Tangani Notifikasi Early Warning PostGIS
  const lastClusterAlertRef = useRef<string | null>(null);

  useEffect(() => {
    if (nearbyCluster && lastClusterAlertRef.current !== nearbyCluster.id) {
      lastClusterAlertRef.current = nearbyCluster.id;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {}
      );
      const timer = setTimeout(() => {
        triggerShockAlert(
          {
            id: `hazard_${nearbyCluster.id}`,
            title: `Road Hazard Ahead (${
              nearbyCluster.distance_meters
                ? `${nearbyCluster.distance_meters.toFixed(0)}m`
                : "25m"
            })`,
            subtitle: `Verified Cluster • Severity: ${nearbyCluster.severity.toUpperCase()}`,
            severity: "warning",
          },
          5000
        );
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [nearbyCluster, triggerShockAlert]);

  // Sinkronisasi antrean deteksi nyata ke Backend (TIDAK membuat titik palsu jika tidak ada deteksi)
  const saveRideSessionTelemetry = useCallback(() => {
    if (hasSavedSessionRef.current) return;
    hasSavedSessionRef.current = true;

    offlineQueue.flush().catch((err) => {
      console.warn("[RideScreen] Gagal flush antrean:", err);
    });
  }, []);

  // Selesai Perjalanan via tombol End Ride (Tampilkan ringkasan Trip Completed)
  const handleStopDrive = async () => {
    stopTracking();
    await backgroundTrackingService.stopBackgroundTracking().catch(() => {});

    // 1. Tentukan nama destinasi:
    // Jika rute tujuan ditentukan pengguna -> pakai nama tujuan tersebut
    // Jika tidak menetapkan tujuan -> otomatis deteksi tempat pemberhentian akhir via reverseGeocode
    let finalDest = destination?.name;
    const finalEndCoords = liveCoordsRef.current || startCoordsRef.current;

    if (!finalDest && finalEndCoords) {
      try {
        finalDest = await routingService.reverseGeocode(finalEndCoords);
      } catch {
        finalDest = `[${finalEndCoords.latitude.toFixed(4)}, ${finalEndCoords.longitude.toFixed(4)}]`;
      }
    } else if (!finalDest) {
      finalDest = "Completed Ride";
    }

    setResolvedDestinationName(finalDest);

    // Hitung road quality score (0–100)
    const roadScore = Math.max(
      30,
      Math.min(
        100,
        Math.round(
          100 -
            detectedCountRef.current * 12 -
            Math.max(0, (maxGForceRef.current - 1.0) * 15)
        )
      )
    );

    // 2. Simpan record sesi perjalanan lengkap ke persistent storage
    const isTfliteModel = Boolean(
      detectedCountRef.current > 0 &&
        lastResultRef.current &&
        !lastResultRef.current.modelVersion?.includes("fallback") &&
        !lastResultRef.current.modelVersion?.includes("heuristic")
    );

    const tripRecord: SavedTripRecord = {
      id: `trip_${Date.now()}`,
      startTime: new Date(tripStartTime).toISOString(),
      endTime: new Date().toISOString(),
      elapsedSeconds,
      distanceMeters: totalDistanceMeters,
      maxGForce:
        detectedCountRef.current > 0 || totalDistanceMeters >= 5
          ? maxGForceRef.current
          : 0,
      anomalyCount: detectedCountRef.current,
      vehicleName: vehicleProfile.name,
      vehiclePlate: vehicleProfile.plate,
      vehicleType: vehicleProfile.type,
      startLocationName,
      destinationName: finalDest,
      startCoords: startCoordsRef.current,
      destinationCoords: destination?.coords || finalEndCoords,
      roadScore,
      isTflite: isTfliteModel,
      confidencePercent:
        detectedCountRef.current > 0 && lastResultRef.current
          ? Math.round(lastResultRef.current.confidence * 100)
          : 0,
      confidenceTier:
        detectedCountRef.current > 0 && lastResultRef.current
          ? lastResultRef.current.confidenceTier
          : "NONE",
    };

    tripStorage.saveTrip(tripRecord).catch((err) => {
      console.warn("[RideScreen] Error saving trip to storage:", err);
    });

    saveRideSessionTelemetry();
    setIsFinished(true);
  };

  // Kembali ke Main Page via tombol Back pojok kiri atas:
  // Menjalankan proses penghentian & flush data deteksi nyata yang sama seperti End Ride,
  // namun tanpa menampilkan modal 'Trip Completed' dan langsung ke Main Page.
  const handleBackToMain = useCallback(() => {
    setIsPaused(true);
    stopTracking();
    saveRideSessionTelemetry();
    backgroundTrackingService.stopBackgroundTracking().catch(() => {});

    // Jika kendaraan sudah menempuh jarak nyata >= 50m, simpan sebagai riwayat perjalanan
    if (totalDistanceMeters >= 50) {
      const finalEndCoords = liveCoordsRef.current || startCoordsRef.current;
      const finalDest =
        destination?.name ||
        (finalEndCoords
          ? `[${finalEndCoords.latitude.toFixed(4)}, ${finalEndCoords.longitude.toFixed(4)}]`
          : "Drive Session");

      const tripRecord: SavedTripRecord = {
        id: `trip_${Date.now()}`,
        startTime: new Date(tripStartTime).toISOString(),
        endTime: new Date().toISOString(),
        elapsedSeconds,
        distanceMeters: totalDistanceMeters,
        maxGForce: detectedCountRef.current > 0 ? maxGForceRef.current : 0,
        anomalyCount: detectedCountRef.current,
        vehicleName: vehicleProfile.name,
        vehiclePlate: vehicleProfile.plate,
        vehicleType: vehicleProfile.type,
        startLocationName,
        destinationName: finalDest,
        startCoords: startCoordsRef.current,
        destinationCoords: destination?.coords || finalEndCoords,
        roadScore: 85,
      };
      tripStorage.saveTrip(tripRecord).catch(() => {});
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, [
    router,
    stopTracking,
    saveRideSessionTelemetry,
    totalDistanceMeters,
    destination?.name,
    destination?.coords,
    elapsedSeconds,
    vehicleProfile.name,
    vehicleProfile.plate,
    vehicleProfile.type,
    startLocationName,
    tripStartTime,
  ]);

  // Tangani tombol hardware Back Android agar konsisten menyimpan data & langsung ke Main Page
  useEffect(() => {
    if (isFinished) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBackToMain();
      return true;
    });
    return () => sub.remove();
  }, [isFinished, handleBackToMain]);

  const handleHazardPress = useCallback(
    (point: DamagePoint) => {
      const dist =
        liveCoordsRef.current
          ? `${Math.round(haversineMeters(liveCoordsRef.current, point.position))}m away`
          : `Reports: ${point.reportCount}`;
      triggerShockAlert(
        {
          id: `inspect_${point.id}`,
          title: `Recorded Road Hazard (${dist})`,
          subtitle: `Severity: ${point.severity.toUpperCase()} • ${point.reportCount} report(s) in area`,
          severity: point.severity === "high" ? "danger" : "warning",
        },
        4500
      );
    },
    [triggerShockAlert]
  );

  const handleStopDriveRef = useRef(handleStopDrive);
  useEffect(() => {
    handleStopDriveRef.current = handleStopDrive;
  });
  const handleStopDriveStable = useCallback(() => {
    void handleStopDriveRef.current();
  }, []);

  const handleTogglePause = useCallback(() => {
    setIsPaused((value) => !value);
  }, []);

  const handleOpenEmergency = useCallback(() => {
    setIsEmergencyVisible(true);
  }, []);

  const handleCloseEmergency = useCallback(() => {
    setIsEmergencyVisible(false);
  }, []);

  const handleViewHistory = useCallback(() => {
    setIsFinished(false);
    router.replace("/(tabs)/history");
  }, [router]);

  const handleBackHome = useCallback(() => {
    setIsFinished(false);
    router.replace("/(tabs)");
  }, [router]);

  if (isFinished) {
    const hasRealDetection =
      detectedCount > 0 && Boolean(lastResult?.isAnomalyDetected);
    const isTflite = Boolean(
      hasRealDetection &&
        lastResult &&
        !lastResult.modelVersion?.includes("fallback") &&
        !lastResult.modelVersion?.includes("heuristic")
    );
    const confPercent =
      hasRealDetection && lastResult
        ? Math.round(lastResult.confidence * 100)
        : 0;
    const confTier =
      hasRealDetection && lastResult ? lastResult.confidenceTier : "NONE";

    return (
      <TripCompletedView
        data={{
          elapsedSeconds,
          detectedCount,
          maxGForce:
            detectedCount > 0 || totalDistanceMeters >= 5 || maxGForce > 1.05
              ? maxGForce
              : 0,
          distanceMeters: totalDistanceMeters,
          vehicleName: vehicleProfile.name,
          vehiclePlate: vehicleProfile.plate,
          vehicleType: vehicleProfile.type,
          isTflite,
          confidencePercent: confPercent,
          confidenceTier: confTier,
          destinationName: resolvedDestinationName || destination?.name,
          startLocationName,
        }}
        onViewHistory={handleViewHistory}
        onBackHome={handleBackHome}
      />
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.canvas }}>
      <LiveMap
        isPaused={isPaused}
        currentCoords={liveCoords}
        routeHistory={routeHistory}
        plannedRoute={destination?.plannedRoute}
        liveDetections={allRoadHazards}
        vehicleType={vehicleProfile.id}
        onDamagePress={handleHazardPress}
      />

      <View className="absolute inset-0">
        <TopFloatingBar
          onBack={handleBackToMain}
          onOpenEmergency={handleOpenEmergency}
          destinationName={destination?.name}
          remainingDistanceMeters={remainingDistanceMeters}
        />

        {/* FLOATING BOTTOM HUD SHEET */}
        <View className="absolute inset-x-0 bottom-0 z-20">
          <BottomHud
            vehicleName={vehicleProfile.name}
            plate={vehicleProfile.plate}
            speed={currentSpeed}
            vibration={currentVibration}
            shockLevel={shockLevel}
            gForce={liveGForce}
            peakGForce={maxGForce}
            anomalyCount={detectedCount}
            elapsedSeconds={elapsedSeconds}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            onStop={handleStopDriveStable}
            shockAlert={activeShockAlert}
            onDismissShockAlert={handleDismissShockAlert}
          />
        </View>
      </View>

      {/* MODAL PUSAT BANTUAN DARURAT (HOTLINE & SHARE LIVE LOCATION) */}
      <EmergencyModal
        visible={isEmergencyVisible}
        onClose={handleCloseEmergency}
        currentCoords={liveCoords}
        speedKmh={currentSpeed}
      />
    </View>
  );
}
