import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { BackHandler, InteractionManager, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Accelerometer, Gyroscope } from "expo-sensors";

import { BottomHud, type ShockAlert } from "@/components/ride/bottom-hud";
import { LiveMap } from "@/components/ride/live-map";
import { TopFloatingBar } from "@/components/ride/top-floating-bar";
import { TripCompletedView } from "@/components/ride/trip-completed-view";
import { useVehicle } from "@/contexts/vehicle-context";
import { EDGE_AI_CONFIG } from "@/edge-ai/model-config";
import type { RawSensorSample } from "@/edge-ai/types";
import { defaultEdgeDetector } from "@/edge-ai/detector";
import { useAuth } from "@/hooks/use-auth";
import { useDetections } from "@/hooks/use-detections";
import { useEdgeAi } from "@/hooks/use-edge-ai";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";
import { useUserLocation } from "@/hooks/use-user-location";
import { offlineQueue } from "@/services/api/offline-queue";
import { tokenStorage } from "@/services/api/token-storage";
import { backgroundTrackingService } from "@/services/background-tracking";
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
  const { user } = useAuth();
  const { vehicleProfile } = useVehicle();
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

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
      backgroundTrackingService.startBackgroundTracking("idle").catch(() => {});
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

  useEffect(() => {
    liveCoordsRef.current = liveCoords;
    gpsSpeedRef.current = gpsSpeed;
    vehicleProfileRef.current = vehicleProfile;
  }, [liveCoords, gpsSpeed, vehicleProfile]);

  // Kecepatan spidometer terkalibrasi secara dinamis sesuai profil kendaraan
  const currentSpeed = useMemo(() => {
    if (isPaused || isFinished) return 0;
    const minSpeed = vehicleProfile.sensorConfig.minMovingSpeed ?? 3.5;
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
        severity: c.severity === "severe" ? "high" : c.severity,
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
      if (typeof d.speedKmh === "number" && d.speedKmh < 3.5) continue;
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
              ? "high"
              : d.zAccelPeak && d.zAccelPeak >= 1.7
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

      // 2. Proyeksi akselerasi vertikal murni (sejajar gravitasi)
      const aVert = x * gUnitX + y * gUnitY + z * gUnitZ;
      const dynamicVerticalG = Math.abs(aVert - gNorm);

      // Total magnitudo untuk tampilan display HUD
      const totalG = Math.sqrt(x * x + y * y + z * z);
      const roundedG = Math.round(totalG * 100) / 100;

      const currentProfile = vehicleProfileRef.current;
      const currentGpsSpeed = gpsSpeedRef.current;
      const minSpeed = currentProfile.sensorConfig.minMovingSpeed ?? 3.5;
      const isMoving = currentGpsSpeed >= minSpeed;

      // Shock gauge visual (0–100) & G-Force hanya aktif saat kendaraan bergerak
      const computedLevel = isMoving
        ? Math.min(
            100,
            Math.max(
              8,
              Math.round(
                dynamicVerticalG *
                  currentProfile.sensorConfig.shockGaugeMultiplier +
                  10
              )
            )
          )
        : 0;

      // Vibrasi sasis dinamis (m/s²) sesuai standar kendaraan (0 saat diam)
      const idleVib = currentProfile.sensorConfig.idleVibration ?? 0;
      let dynamicVib = 0;
      if (isMoving) {
        dynamicVib = Math.round(
          (dynamicVerticalG * 9.81 * 2.8 + idleVib) *
            currentProfile.sensorConfig.vibrationFactor
        );
        dynamicVib = Math.min(180, Math.max(idleVib, dynamicVib));
      }

      const activeG = isMoving ? roundedG : 0;

      // Throttle pembaruan state React UI ke ~5 Hz (setiap 200ms) untuk mencegah re-render banjir bridge
      const now = Date.now();
      if (now - lastUiUpdateRef.current >= 200) {
        lastUiUpdateRef.current = now;
        setLiveGForce(activeG);
        if (isMoving) {
          setMaxGForce((prev) => Math.max(prev, roundedG));
        }
        setShockLevel(computedLevel);
        setCurrentVibration(dynamicVib);
      }

      // Tambahkan ke rolling window buffer Edge AI (20 Hz)
      const sample: RawSensorSample = {
        ax: x,
        ay: y,
        az: z,
        gx: gyroRef.current.gx,
        gy: gyroRef.current.gy,
        gz: gyroRef.current.gz,
        speedKmh: currentGpsSpeed,
        timestampMs: now,
      };
      addSampleRef.current(sample);

      // Pre-filter Trigger evaluasi Edge AI (hanya saat kendaraan bergerak nyata)
      const shockThreshold = currentProfile.sensorConfig.zShockThreshold;
      const isCooldownPassed =
        now - lastDetectionTimeRef.current > EDGE_AI_CONFIG.detectionCooldownMs;

      if (isMoving && dynamicVerticalG >= shockThreshold && isCooldownPassed) {
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
          currentProfile.sensorConfig
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
                  : `Pothole Detected (${confPct}% Conf • ${dynamicVerticalG.toFixed(2)}G)`,
                subtitle: "Road defect registered & logged",
                gForce: dynamicVerticalG,
                severity: dynamicVerticalG > 1.8 ? "danger" : "warning",
              });

              const newDamage: DamagePoint = {
                id: `det_${Date.now()}`,
                position: { latitude: currentLat, longitude: currentLon },
                severity:
                  res.estimatedSeverity === "severe" ||
                  res.estimatedSeverity === "high"
                    ? "high"
                    : "medium",
                reportCount: 1,
              };
              setLiveDetections((prev) => [...prev, newDamage]);
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
    setIsFinished(true);
    stopTracking();
    saveRideSessionTelemetry();
    await backgroundTrackingService.startBackgroundTracking("idle").catch(() => {});
  };

  // Kembali ke Main Page via tombol Back pojok kiri atas:
  // Menjalankan proses penghentian & flush data deteksi nyata yang sama seperti End Ride,
  // namun tanpa menampilkan modal 'Trip Completed' dan langsung ke Main Page.
  const handleBackToMain = useCallback(() => {
    setIsPaused(true);
    stopTracking();
    saveRideSessionTelemetry();
    backgroundTrackingService.startBackgroundTracking("idle").catch(() => {});

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, [router, stopTracking, saveRideSessionTelemetry]);

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
          maxGForce: detectedCount > 0 || totalDistanceMeters >= 5 ? maxGForce : 0,
          distanceMeters: totalDistanceMeters,
          vehicleName: vehicleProfile.name,
          vehiclePlate: vehicleProfile.plate,
          vehicleType: vehicleProfile.type,
          isTflite,
          confidencePercent: confPercent,
          confidenceTier: confTier,
        }}
        onViewHistory={() => {
          setIsFinished(false);
          router.replace("/(tabs)/history");
        }}
        onBackHome={() => {
          setIsFinished(false);
          router.replace("/(tabs)");
        }}
      />
    );
  }

  return (
    <View className="flex-1 bg-custom-black">
      <LiveMap
        isPaused={isPaused}
        currentCoords={liveCoords}
        routeHistory={routeHistory}
        liveDetections={allRoadHazards}
        vehicleType={vehicleProfile.id}
        onDamagePress={handleHazardPress}
      />

      <View className="absolute inset-0">
        <TopFloatingBar onBack={handleBackToMain} />

        {/* FLOATING BOTTOM HUD SHEET */}
        <View className="absolute inset-x-0 bottom-0 z-20">
          <BottomHud
            vehicleName={vehicleProfile.name}
            plate={vehicleProfile.plate}
            speed={currentSpeed}
            vibration={currentVibration}
            shockLevel={shockLevel}
            gForce={liveGForce}
            anomalyCount={detectedCount}
            elapsedSeconds={elapsedSeconds}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused((value) => !value)}
            onStop={handleStopDrive}
            shockAlert={activeShockAlert}
            onDismissShockAlert={handleDismissShockAlert}
          />
        </View>
      </View>
    </View>
  );
}
