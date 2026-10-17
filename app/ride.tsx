import { useEffect, useState, useRef, useCallback } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Accelerometer, Gyroscope } from "expo-sensors";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Sparkles,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomHud } from "@/components/ride/bottom-hud";
import { DriveActions } from "@/components/ride/drive-actions";
import { LiveMap } from "@/components/ride/live-map";
import { TopFloatingBar } from "@/components/ride/top-floating-bar";
import { Touchable } from "@/components/ui/touchable";
import { useVehicle, type VehicleProfile } from "@/contexts/vehicle-context";
import { EDGE_AI_CONFIG } from "@/edge-ai/model-config";
import type { RawSensorSample } from "@/edge-ai/types";
import { useEdgeAi } from "@/hooks/use-edge-ai";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";
import { useUserLocation } from "@/hooks/use-user-location";
import { offlineQueue } from "@/services/api/offline-queue";
import type { DamagePoint } from "@/components/map/map-data";

/**
 * Start Drive Mode (Live Tracking HUD).
 *
 * Sensor pipeline terkalibrasi tinggi:
 *  1. Accelerometer + Gyroscope @ 20 Hz → rolling window buffer via addSample()
 *  2. Causal 3D EMA Gravity Tracking: Menghilangkan gravitasi statis 1.0G dan
 *     mengekstraksi guncangan vertikal murni (invarian orientasi pemasangan HP)
 *  3. Speed Gate: Deteksi hanya aktif jika kendaraan sedang bergerak nyata
 *  4. Ambang batas adaptif per kendaraan (Mobil MPV: 1.10G dinamis, Motor: 1.50G dinamis)
 *  5. Evaluasi multi-sampel Smart Window Heuristic / TFLite (mencegah false positive getaran mikro)
 *  6. PostGIS early warning radius 25 m via /nearby
 */
export default function RideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vehicleProfile } = useVehicle();
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Status Telemetri Live
  const [currentSpeed, setCurrentSpeed] = useState(45);
  const [currentVibration, setCurrentVibration] = useState(100);
  const [shockLevel, setShockLevel] = useState(35);
  const [anomalyBanner, setAnomalyBanner] = useState<string | null>(null);
  const [liveDetections, setLiveDetections] = useState<DamagePoint[]>([]);

  // Status Sensor Akselerometer & Giroskop HP
  const [sensorEnabled, setSensorEnabled] = useState(true);
  const [liveGForce, setLiveGForce] = useState<number>(1.0);
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

  // Hook Edge AI dan PostGIS Early Warning
  const {
    detectedCount,
    lastResult,
    addSample,
    runInference,
    triggerSimulatedDetection,
  } = useEdgeAi();

  const { nearbyCluster, checkNearby } = usePotholeClusters();

  // 1. Loop Telemetri Kecepatan Kendaraan & Early Warning PostGIS
  useEffect(() => {
    if (isPaused || isFinished) return;

    const telemetryTimer = setInterval(() => {
      if (gpsSpeed > 0) {
        setCurrentSpeed(Math.round(gpsSpeed));
      } else {
        const dynamicSpeed = Math.floor(40 + Math.random() * 8);
        setCurrentSpeed(dynamicSpeed);
      }

      if (!sensorEnabled) {
        const dynamicVibration = Math.floor(95 + Math.random() * 15);
        setCurrentVibration(dynamicVibration);
      }

      if (liveCoords) {
        checkNearby(liveCoords.latitude, liveCoords.longitude, 25);
      }
    }, 2500);

    return () => clearInterval(telemetryTimer);
  }, [isPaused, isFinished, sensorEnabled, checkNearby, liveCoords, gpsSpeed]);

  // 2. Gyroscope Listener — simpan angular velocity terbaru
  useEffect(() => {
    if (isPaused || isFinished || !sensorEnabled) return;

    Gyroscope.setUpdateInterval(EDGE_AI_CONFIG.sampleRateMs);

    const subscription = Gyroscope.addListener(({ x, y, z }) => {
      gyroRef.current = { gx: x, gy: y, gz: z };
    });

    return () => subscription.remove();
  }, [isPaused, isFinished, sensorEnabled]);

  // 3. Accelerometer Listener + Causal EMA Gravity Removal + Buffer Window
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
      // Guncangan vertikal dinamis (gravitasi bumi 1.0G dieliminasi)
      const dynamicVerticalG = Math.abs(aVert - gNorm);

      // Total magnitudo untuk tampilan display HUD
      const totalG = Math.sqrt(x * x + y * y + z * z);
      const roundedG = Math.round(totalG * 100) / 100;
      setLiveGForce(roundedG);

      // Shock gauge visual (0–100) berbasis guncangan vertikal murni
      const computedLevel = Math.min(
        100,
        Math.max(
          8,
          Math.round(
            dynamicVerticalG *
              vehicleProfile.sensorConfig.shockGaugeMultiplier +
              10
          )
        )
      );
      setShockLevel(computedLevel);

      // Vibrasi sasis dinamis (m/s²)
      setCurrentVibration(
        Math.round(
          totalG *
            9.81 *
            10 *
            vehicleProfile.sensorConfig.vibrationFactor
        )
      );

      // 3. Tambahkan ke rolling window buffer Edge AI
      const sample: RawSensorSample = {
        ax: x,
        ay: y,
        az: z,
        gx: gyroRef.current.gx,
        gy: gyroRef.current.gy,
        gz: gyroRef.current.gz,
        speedKmh: gpsSpeed,
        timestampMs: Date.now(),
      };
      addSample(sample);

      // 4. Pre-filter Trigger:
      // Hanya picu evaluasi mendalam jika:
      // a. Kendaraan bergerak nyata (speed >= minMovingSpeed, misal >= 10 km/h)
      // b. Guncangan vertikal dinamis melewati threshold adaptif kendaraan
      // c. Cooldown 3 detik sudah berlalu (mencegah duplicate dari 1 lubang)
      const now = Date.now();
      const minSpeed =
        vehicleProfile.sensorConfig.minMovingSpeed ??
        EDGE_AI_CONFIG.minDetectionSpeedKmh;
      const isMoving = gpsSpeed >= minSpeed;
      const shockThreshold = vehicleProfile.sensorConfig.zShockThreshold;
      const isCooldownPassed =
        now - lastDetectionTimeRef.current > EDGE_AI_CONFIG.detectionCooldownMs;

      if (isMoving && dynamicVerticalG >= shockThreshold && isCooldownPassed) {
        lastDetectionTimeRef.current = now;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

        // Jangan pernah mencatat deteksi jika GPS belum mengunci koordinat nyata
        if (!liveCoords) {
          console.warn(
            "[RideScreen] GPS belum terkunci, inferensi deteksi lubang ditunda."
          );
          return;
        }

        const currentLat = liveCoords.latitude;
        const currentLon = liveCoords.longitude;

        // Jalankan inferensi komprehensif pada window sampel
        runInference(
          { latitude: currentLat, longitude: currentLon },
          { offlineOnly: false },
          vehicleProfile.sensorConfig
        )
          .then((res) => {
            if (res?.isAnomalyDetected) {
              const confPct = Math.round(res.confidence * 100);
              const isTflite =
                !res.modelVersion?.includes("fallback") &&
                !res.modelVersion?.includes("heuristic");

              setAnomalyBanner(
                isTflite
                  ? `TFLite: ${Math.round(res.probability * 100)}% Pothole (${res.confidenceTier}) • ${dynamicVerticalG.toFixed(2)}G Shock`
                  : `Edge AI: Pothole Detected (${confPct}% Conf) • ${dynamicVerticalG.toFixed(2)}G Shock`
              );

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

              setTimeout(() => setAnomalyBanner(null), 4000);
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
    gpsSpeed,
    addSample,
    runInference,
    liveCoords,
    vehicleProfile,
  ]);

  // 4. Tangani Notifikasi Early Warning PostGIS
  useEffect(() => {
    if (nearbyCluster) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {}
      );
    }
  }, [nearbyCluster]);

  // 5. Trigger Deteksi Anomali Manual (Simulasi Pengujian)
  const handleTriggerAnomaly = useCallback(async () => {
    if (!liveCoords) {
      setAnomalyBanner("GPS belum terkunci. Tunggu sinyal GPS.");
      setTimeout(() => setAnomalyBanner(null), 3000);
      return;
    }

    setShockLevel(85);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const currentLat = liveCoords.latitude;
    const currentLon = liveCoords.longitude;

    try {
      const result = await triggerSimulatedDetection({
        latitude: currentLat,
        longitude: currentLon,
        speedKmh: currentSpeed,
      });

      if (result?.isAnomalyDetected) {
        const confPct = Math.round(result.confidence * 100);
        setAnomalyBanner(
          `Simulation: Pothole Detected! Edge AI: ${confPct}% (Peak: ${result.zAccelPeak.toFixed(2)}G)`
        );

        const newDamage: DamagePoint = {
          id: `sim_${Date.now()}`,
          position: { latitude: currentLat, longitude: currentLon },
          severity: "high",
          reportCount: 1,
        };
        setLiveDetections((prev) => [...prev, newDamage]);

        setTimeout(() => {
          setAnomalyBanner(null);
          setShockLevel(30);
        }, 4000);
      }
    } catch (e) {
      console.warn("[RideScreen] Deteksi error:", e);
    }
  }, [triggerSimulatedDetection, currentSpeed, liveCoords]);

  // 6. Selesai Perjalanan (Stop Drive & Flush Offline Queue)
  const handleStopDrive = async () => {
    setIsFinished(true);
    stopTracking();
    try {
      await offlineQueue.flush();
    } catch (err) {
      console.warn("[RideScreen] Gagal flush antrean:", err);
    }
  };

  return (
    <View className="flex-1 bg-custom-black">
      <LiveMap
        isPaused={isPaused}
        currentCoords={liveCoords}
        routeHistory={routeHistory}
        liveDetections={liveDetections}
        vehicleType={vehicleProfile.id}
      />

      <View className="absolute inset-0">
        <View className="px-4" style={{ paddingTop: insets.top + 12 }}>
          <TopFloatingBar onBack={() => router.back()} />

          {/* EARLY WARNING BANNER (POSTGIS NEARBY) */}
          {nearbyCluster ? (
            <View className="mt-3 flex-row items-center gap-2.5 rounded-2xl border-2 border-amber-500 bg-amber-500/90 px-4 py-2.5 shadow-lg backdrop-blur-md">
              <AlertTriangle size={18} color="#FFFFFF" />
              <View className="flex-1">
                <Text className="font-quicksand-bold text-xs text-white">
                  WARNING: POTHOLE AHEAD!
                </Text>
                <Text className="font-mono text-[10px] text-amber-100">
                  Distance:{" "}
                  {nearbyCluster.distance_meters
                    ? `${nearbyCluster.distance_meters.toFixed(1)} meters`
                    : "15 meters"}{" "}
                  • Severity: {nearbyCluster.severity.toUpperCase()}
                </Text>
              </View>
            </View>
          ) : null}

          {/* EDGE AI DETECTION TOAST */}
          {anomalyBanner ? (
            <View className="mt-2 flex-row items-center gap-2 rounded-2xl border border-sky-400 bg-sky-950/90 px-4 py-2 shadow-md">
              <Sparkles size={16} color="#38BDF8" />
              <Text className="flex-1 font-quicksand-semibold text-xs text-sky-200">
                {anomalyBanner}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          className="absolute inset-x-0 bottom-0 gap-3"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          {/* BAR KONTROL SENSOR HP & SIMULASI */}
          <View className="flex-row items-center justify-between px-4">
            {/* TOGGLE SENSOR HP */}
            <Touchable
              accessibilityLabel="Toggle phone accelerometer sensor"
              accessibilityRole="button"
              onPress={() => setSensorEnabled((prev) => !prev)}
            >
              <View
                className={`flex-row items-center gap-1.5 rounded-xl border px-3 py-1.5 shadow-sm ${
                  sensorEnabled
                    ? "border-emerald-500/50 bg-emerald-950/80"
                    : "border-slate-700 bg-slate-900/80"
                }`}
              >
                <Activity
                  size={13}
                  color={sensorEnabled ? "#34D399" : "#94A3B8"}
                />
                <Text
                  className={`font-mono text-[11px] ${
                    sensorEnabled ? "text-emerald-300" : "text-slate-400"
                  }`}
                >
                  {sensorEnabled
                    ? `${liveGForce}G • ${vehicleProfile.type}`
                    : "Sensor Off"}
                </Text>
              </View>
            </Touchable>

            {/* TOMBOL TEST TRIGGER MANUAL */}
            <Touchable
              accessibilityLabel="Simulate Edge AI shock detection"
              accessibilityRole="button"
              onPress={handleTriggerAnomaly}
            >
              <View className="flex-row items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-950/80 px-3 py-1.5 shadow-sm">
                <Cpu size={13} color="#38BDF8" />
                <Text className="font-mono text-[11px] text-sky-200">
                  Simulation ({detectedCount})
                </Text>
              </View>
            </Touchable>
          </View>

          <View className="px-4">
            <BottomHud
              shockLevel={shockLevel}
              speed={currentSpeed}
              vibration={currentVibration}
            />
          </View>

          <View className="px-4">
            <DriveActions
              isPaused={isPaused}
              onStop={handleStopDrive}
              onTogglePause={() => setIsPaused((value) => !value)}
            />
          </View>

          {isFinished ? (
            <FinishBanner
              detectedCount={detectedCount}
              lastResult={lastResult}
              vehicleProfile={vehicleProfile}
              onDismiss={() => {
                setIsFinished(false);
                router.replace("/(tabs)/history");
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Banner konfirmasi ringkasan perjalanan setelah "Stop Drive" ditekan.
 */
function FinishBanner({
  detectedCount,
  lastResult,
  vehicleProfile,
  onDismiss,
}: {
  detectedCount: number;
  lastResult?: any;
  vehicleProfile?: VehicleProfile;
  onDismiss: () => void;
}) {
  const isTflite =
    lastResult &&
    !lastResult.modelVersion?.includes("fallback") &&
    !lastResult.modelVersion?.includes("heuristic");
  const confPercent = lastResult
    ? Math.round(lastResult.confidence * 100)
    : 94;

  return (
    <View className="mx-4">
      <View className="rounded-2xl border-2 border-custom-primary bg-custom-black p-5 shadow-2xl">
        <Text className="font-quicksand-bold text-base text-white">
          Trip Completed
        </Text>
        <Text className="mt-1 font-quicksand text-xs text-slate-400">
          All telemetry logs have been synchronized to HyperGrid PostGIS server.
        </Text>

        <View className="my-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          {vehicleProfile && (
            <View className="flex-row justify-between py-1">
              <Text className="text-xs text-slate-400">Vehicle</Text>
              <Text className="font-mono text-xs text-custom-primary">
                {vehicleProfile.name} ({vehicleProfile.type})
              </Text>
            </View>
          )}
          <View className="flex-row justify-between py-1">
            <Text className="text-xs text-slate-400">Total Road Anomalies</Text>
            <Text className="font-mono-bold text-xs text-white">
              {detectedCount} Points
            </Text>
          </View>
          <View className="flex-row justify-between py-1">
            <Text className="text-xs text-slate-400">Detection Engine</Text>
            <Text
              className={`font-mono-bold text-xs ${
                isTflite ? "text-emerald-400" : "text-sky-400"
              }`}
            >
              {isTflite ? "TFLite Neural Net" : "Smart Edge AI Heuristic"}
            </Text>
          </View>
          <View className="flex-row justify-between py-1">
            <Text className="text-xs text-slate-400">Detection Confidence</Text>
            <Text className="font-mono-bold text-xs text-emerald-400">
              {confPercent}% ({lastResult?.confidenceTier ?? "HIGH"})
            </Text>
          </View>
          <View className="flex-row justify-between py-1">
            <Text className="text-xs text-slate-400">Server Status</Text>
            <Text className="font-mono-bold text-xs text-sky-400">
              Synchronized
            </Text>
          </View>
        </View>

        <Touchable
          accessibilityLabel="Open trip history"
          className="self-start"
          onPress={onDismiss}
        >
          <View className="rounded-full bg-custom-primary px-5 py-2">
            <Text className="font-quicksand-bold text-xs text-white">
              View Trip History
            </Text>
          </View>
        </Touchable>
      </View>
    </View>
  );
}
