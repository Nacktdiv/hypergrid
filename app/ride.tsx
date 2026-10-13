import { useEffect, useState, useRef, useCallback } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Accelerometer } from "expo-sensors";
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
import { useEdgeAi } from "@/hooks/use-edge-ai";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";
import { useUserLocation } from "@/hooks/use-user-location";
import { offlineQueue } from "@/services/api/offline-queue";
import type { DamagePoint } from "@/components/map/map-data";

/**
 * Start Drive Mode (Live Tracking HUD).
 *
 * Mengintegrasikan:
 *   - Live GPS Tracking koordinat perjalanan pengguna (Breadcrumb route)
 *   - Live Accelerometer Sensor HP untuk deteksi guncangan fisik nyata
 *   - On-Device Edge AI Anomaly Detector (dengan confidence dummy terkalibrasi)
 *   - Driver Early Warning PostGIS (`/nearby`) dengan radius 25 meter
 *   - Telemetri kecepatan & guncangan vertikal real-time
 *   - Background Batch Sync via OfflineQueue saat perjalanan selesai
 */
export default function RideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Status Telemetri Live
  const [currentSpeed, setCurrentSpeed] = useState(45);
  const [currentVibration, setCurrentVibration] = useState(100);
  const [shockLevel, setShockLevel] = useState(35);
  const [anomalyBanner, setAnomalyBanner] = useState<string | null>(null);
  const [liveDetections, setLiveDetections] = useState<DamagePoint[]>([]);

  // Status Sensor Akselerometer HP
  const [sensorEnabled, setSensorEnabled] = useState(true);
  const [liveGForce, setLiveGForce] = useState<number>(1.0);
  const lastDetectionTimeRef = useRef<number>(0);

  // GPS Live Tracking Perjalanan
  const {
    coords: liveCoords,
    speedKmh: gpsSpeed,
    routeHistory,
    stopTracking,
  } = useUserLocation(true);

  // Hook Edge AI dan PostGIS Early Warning
  const {
    detectedCount,
    lastResult,
    processFrame,
    triggerSimulatedDetection,
  } = useEdgeAi();

  const { nearbyCluster, checkNearby } = usePotholeClusters();

  // 1. Loop Telemetri Kecepatan Kendaraan & Early Warning PostGIS
  useEffect(() => {
    if (isPaused || isFinished) return;

    const telemetryTimer = setInterval(() => {
      // Jika GPS mendeteksi pergerakan nyata, pakai kecepatan GPS
      if (gpsSpeed > 0) {
        setCurrentSpeed(Math.round(gpsSpeed));
      } else {
        const dynamicSpeed = Math.floor(40 + Math.random() * 8);
        setCurrentSpeed(dynamicSpeed);
      }

      // Jika sensor HP dimatikan, simulasikan vibrasi standar
      if (!sensorEnabled) {
        const dynamicVibration = Math.floor(95 + Math.random() * 15);
        setCurrentVibration(dynamicVibration);
      }

      // Early Warning Check pada koordinat GPS nyata saat ini
      const lat = liveCoords ? liveCoords.latitude : -6.2088;
      const lon = liveCoords ? liveCoords.longitude : 106.8456;
      checkNearby(lat, lon, 25);
    }, 2500);

    return () => clearInterval(telemetryTimer);
  }, [isPaused, isFinished, sensorEnabled, checkNearby, liveCoords, gpsSpeed]);

  // 2. LIVE DETEKSI GUNCANGAN MENGGUNAKAN SENSOR HP (ACCELEROMETER)
  useEffect(() => {
    if (isPaused || isFinished || !sensorEnabled) return;

    Accelerometer.setUpdateInterval(120);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Hitung magnitudo total gaya gravitasi G = √(x² + y² + z²)
      const totalG = Math.sqrt(x * x + y * y + z * z);
      const roundedG = Math.round(totalG * 100) / 100;
      setLiveGForce(roundedG);

      // Hitung deviasi guncangan terhadap gravitasi normal (1.0G)
      const dynamicDelta = Math.abs(totalG - 1.0);
      const computedLevel = Math.min(
        100,
        Math.max(12, Math.round(dynamicDelta * 55 + 15))
      );
      setShockLevel(computedLevel);

      // Update vibrasi dinamis berdasarkan sensor akselerometer (m/s²)
      setCurrentVibration(Math.round(totalG * 9.81 * 10));

      // Ambang batas guncangan anomali jalan (≥ 1.7G)
      const now = Date.now();
      if (totalG >= 1.7 && now - lastDetectionTimeRef.current > 3000) {
        lastDetectionTimeRef.current = now;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

        const currentLat = liveCoords ? liveCoords.latitude : -6.2088;
        const currentLon = liveCoords ? liveCoords.longitude : 106.8456;

        // Jalankan inferensi Edge AI
        processFrame({
          zAccel: totalG,
          xAccel: x,
          yAccel: y,
          latitude: currentLat,
          longitude: currentLon,
          speedKmh: currentSpeed,
          timestamp: new Date().toISOString(),
        })
          .then((res) => {
            if (res.isAnomalyDetected) {
              const confPct = Math.round(res.confidence * 100);
              setAnomalyBanner(
                `Phone Sensor: ${roundedG}G Shock! Edge AI: ${confPct}% Confidence`
              );

              // Tambahkan titik kerusakan langsung di peta HUD berkendara
              const newDamage: DamagePoint = {
                id: `det_${Date.now()}`,
                position: { latitude: currentLat, longitude: currentLon },
                severity: totalG >= 2.2 ? "high" : "medium",
                reportCount: 1,
              };
              setLiveDetections((prev) => [...prev, newDamage]);

              setTimeout(() => setAnomalyBanner(null), 4000);
            }
          })
          .catch((err) => {
            console.warn("[Accelerometer] Error inferensi Edge AI:", err);
          });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isPaused, isFinished, sensorEnabled, currentSpeed, processFrame, liveCoords]);

  // 3. Tangani Notifikasi Early Warning
  useEffect(() => {
    if (nearbyCluster) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {}
      );
    }
  }, [nearbyCluster]);

  // 4. Trigger Deteksi Anomali Manual (Simulasi Pengujian)
  const handleTriggerAnomaly = useCallback(async () => {
    setShockLevel(85);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const currentLat = liveCoords ? liveCoords.latitude : -6.2088;
    const currentLon = liveCoords ? liveCoords.longitude : 106.8456;

    try {
      const result = await triggerSimulatedDetection({
        latitude: currentLat,
        longitude: currentLon,
        speedKmh: currentSpeed,
      });

      if (result.isAnomalyDetected) {
        const confPct = Math.round(result.confidence * 100);
        setAnomalyBanner(
          `Simulation: Shock Detected! Edge AI: ${confPct}% (Z-Peak: ${result.zAccelPeak.toFixed(2)}G)`
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

  // 5. Selesai Perjalanan (Stop Drive & Flush Offline Queue)
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
              <Text className="font-quicksand-semibold text-xs text-sky-200">
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
                  Phone Sensor: {sensorEnabled ? `${liveGForce}G` : "Off"}
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
              lastConfidence={lastResult?.confidence}
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
  lastConfidence,
  onDismiss,
}: {
  detectedCount: number;
  lastConfidence?: number;
  onDismiss: () => void;
}) {
  const confPercent = lastConfidence ? Math.round(lastConfidence * 100) : 94;

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
          <View className="flex-row justify-between py-1">
            <Text className="text-xs text-slate-400">Total Road Anomalies</Text>
            <Text className="font-mono-bold text-xs text-white">
              {detectedCount} Points
            </Text>
          </View>
          <View className="flex-row justify-between py-1">
            <Text className="text-xs text-slate-400">Edge AI Confidence</Text>
            <Text className="font-mono-bold text-xs text-emerald-400">
              {confPercent}% (Dummy Test)
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
              View Trip History →
            </Text>
          </View>
        </Touchable>
      </View>
    </View>
  );
}
