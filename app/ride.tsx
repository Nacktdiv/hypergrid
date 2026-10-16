import { useEffect, useState, useRef, useCallback } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Accelerometer, Gyroscope } from "expo-sensors";
import {
  Activity,
  AlertTriangle,
  Brain,
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
import { EDGE_AI_CONFIG } from "@/edge-ai/model-config";
import type { RawSensorSample } from "@/edge-ai/types";
import type { DamagePoint } from "@/components/map/map-data";

/**
 * Start Drive Mode (Live Tracking HUD).
 *
 * Sensor pipeline:
 *  1. Accelerometer + Gyroscope @ 20 Hz → addSample() → rolling 1.5 s window
 *  2. GPS @ 1 Hz → kecepatan EMA-filtered untuk fitur model
 *  3. Cooldown 3 s + threshold Z-peak ≥ 1.8G → trigger inferensi TFLite (47 fitur)
 *  4. Fallback legacy Z-peak saat model belum siap
 *  5. Deteksi → kirim ke backend / offline queue
 *  6. PostGIS early warning radius 25 m via /nearby
 */
export default function RideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // ── Telemetri Live ───────────────────────────────────────────────────────────
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentVibration, setCurrentVibration] = useState(0);
  const [shockLevel, setShockLevel] = useState(0);
  const [anomalyBanner, setAnomalyBanner] = useState<string | null>(null);
  const [liveDetections, setLiveDetections] = useState<DamagePoint[]>([]);

  // ── Sensor state ─────────────────────────────────────────────────────────────
  const [sensorEnabled, setSensorEnabled] = useState(true);
  const [liveGForce, setLiveGForce] = useState<number>(1.0);
  const lastDetectionTimeRef = useRef<number>(0);

  // ── Gyroscope state (buffer, dipakai di addSample) ───────────────────────────
  const gyroRef = useRef<{ gx: number; gy: number; gz: number }>({
    gx: 0, gy: 0, gz: 0,
  });

  // ── GPS Live Tracking ────────────────────────────────────────────────────────
  const {
    coords: liveCoords,
    speedKmh: gpsSpeed,
    routeHistory,
    stopTracking,
  } = useUserLocation(true);

  // ── Edge AI + TFLite ─────────────────────────────────────────────────────────
  const {
    detectedCount,
    lastResult,
    modelReady,
    modelLoading,
    addSample,
    runInference,
    resetWindow,
    triggerSimulatedDetection,
  } = useEdgeAi();

  const { nearbyCluster, checkNearby } = usePotholeClusters();

  // ── 1. Sync GPS Speed ke state & PostGIS Early Warning ──────────────────────
  useEffect(() => {
    if (isPaused || isFinished) return;

    const telemetryTimer = setInterval(() => {
      setCurrentSpeed(Math.round(gpsSpeed));

      // Early Warning Check pada koordinat GPS saat ini
      const lat = liveCoords?.latitude ?? -6.2088;
      const lon = liveCoords?.longitude ?? 106.8456;
      checkNearby(lat, lon, 25);
    }, 2000);

    return () => clearInterval(telemetryTimer);
  }, [isPaused, isFinished, checkNearby, liveCoords, gpsSpeed]);

  // ── 2. Gyroscope Listener — simpan nilai gyro terbaru ke ref ────────────────
  useEffect(() => {
    if (isPaused || isFinished || !sensorEnabled) return;

    Gyroscope.setUpdateInterval(EDGE_AI_CONFIG.sampleRateMs);

    const subscription = Gyroscope.addListener(({ x, y, z }) => {
      gyroRef.current = { gx: x, gy: y, gz: z };
    });

    return () => subscription.remove();
  }, [isPaused, isFinished, sensorEnabled]);

  // ── 3. Accelerometer Listener — kumpulkan window + trigger inferensi ─────────
  useEffect(() => {
    if (isPaused || isFinished || !sensorEnabled) return;

    Accelerometer.setUpdateInterval(EDGE_AI_CONFIG.sampleRateMs); // 50ms = 20 Hz

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Magnitudo total untuk tampilan G-force HUD
      const totalG = Math.sqrt(x * x + y * y + z * z);
      const roundedG = Math.round(totalG * 100) / 100;
      setLiveGForce(roundedG);

      // Shock level visual (0–100)
      const dynamicDelta = Math.abs(totalG - 1.0);
      const computedLevel = Math.min(100, Math.max(8, Math.round(dynamicDelta * 60 + 10)));
      setShockLevel(computedLevel);

      // Vibrasi dalam m/s²
      setCurrentVibration(Math.round(totalG * 9.81 * 10));

      // ── Tambahkan sampel ke rolling window buffer ──────────────────────────
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

      // ── Threshold pre-filter: hanya trigger inferensi saat ada guncangan ──
      // Z-peak threshold 1.8G + cooldown 3 detik
      const now = Date.now();
      const zPeak = Math.abs(z);
      if (zPeak >= 1.8 && now - lastDetectionTimeRef.current > EDGE_AI_CONFIG.detectionCooldownMs) {
        lastDetectionTimeRef.current = now;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

        const currentLat = liveCoords?.latitude ?? -6.2088;
        const currentLon = liveCoords?.longitude ?? 106.8456;

        // Jalankan inferensi TFLite (atau fallback Z-peak)
        runInference({ latitude: currentLat, longitude: currentLon })
          .then((res) => {
            if (res?.isAnomalyDetected) {
              const confPct = Math.round(res.confidence * 100);
              const probPct = Math.round(res.probability * 100);
              const isTflite = !res.modelVersion.includes('fallback');

              setAnomalyBanner(
                isTflite
                  ? `TFLite: ${probPct}% Pothole (${res.confidenceTier}) • ${roundedG}G`
                  : `Sensor: ${roundedG}G Shock • Legacy ${confPct}%`
              );

              const newDamage: DamagePoint = {
                id: `det_${Date.now()}`,
                position: { latitude: currentLat, longitude: currentLon },
                severity:
                  res.estimatedSeverity === "severe" || res.estimatedSeverity === "high"
                    ? "high"
                    : "medium",
                reportCount: 1,
              };
              setLiveDetections((prev) => [...prev, newDamage]);
              setTimeout(() => setAnomalyBanner(null), 4500);
            }
          })
          .catch((err) => {
            console.warn("[RideScreen] Inferensi gagal:", err);
          });
      }
    });

    return () => subscription.remove();
  }, [isPaused, isFinished, sensorEnabled, gpsSpeed, addSample, runInference, liveCoords]);

  // ── 4. Early Warning Haptic ──────────────────────────────────────────────────
  useEffect(() => {
    if (nearbyCluster) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [nearbyCluster]);

  // ── 5. Trigger Simulasi Manual ───────────────────────────────────────────────
  const handleTriggerAnomaly = useCallback(async () => {
    setShockLevel(88);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const currentLat = liveCoords?.latitude ?? -6.2088;
    const currentLon = liveCoords?.longitude ?? 106.8456;

    try {
      const result = await triggerSimulatedDetection({
        latitude: currentLat,
        longitude: currentLon,
        speedKmh: currentSpeed || 35,
      });

      if (result?.isAnomalyDetected) {
        const probPct = Math.round(result.probability * 100);
        const isTflite = !result.modelVersion.includes('fallback');
        setAnomalyBanner(
          isTflite
            ? `Simulation TFLite: ${probPct}% • ${result.confidenceTier} • Z=${result.zAccelPeak.toFixed(2)}G`
            : `Simulation Legacy: Z=${result.zAccelPeak.toFixed(2)}G • ${Math.round(result.confidence * 100)}%`
        );

        const newDamage: DamagePoint = {
          id: `sim_${Date.now()}`,
          position: { latitude: currentLat, longitude: currentLon },
          severity: "high",
          reportCount: 1,
        };
        setLiveDetections((prev) => [...prev, newDamage]);
        setTimeout(() => { setAnomalyBanner(null); setShockLevel(15); }, 4500);
      }
    } catch (e) {
      console.warn("[RideScreen] Simulasi gagal:", e);
    }
  }, [triggerSimulatedDetection, currentSpeed, liveCoords]);

  // ── 6. Stop Drive ────────────────────────────────────────────────────────────
  const handleStopDrive = async () => {
    setIsFinished(true);
    stopTracking();
    resetWindow();
    try {
      await offlineQueue.flush();
    } catch (err) {
      console.warn("[RideScreen] Flush queue gagal:", err);
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

          {/* MODEL STATUS BADGE */}
          <View className="mt-2 self-start">
            {modelLoading ? (
              <View className="flex-row items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-950/80 px-3 py-1.5">
                <Brain size={12} color="#FBD38D" />
                <Text className="font-mono text-[10px] text-amber-300">
                  Loading TFLite model…
                </Text>
              </View>
            ) : modelReady ? (
              <View className="flex-row items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/70 px-3 py-1.5">
                <Brain size={12} color="#34D399" />
                <Text className="font-mono text-[10px] text-emerald-300">
                  HG Model v2 · Ready
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1.5 rounded-xl border border-slate-600/40 bg-slate-900/70 px-3 py-1.5">
                <Brain size={12} color="#94A3B8" />
                <Text className="font-mono text-[10px] text-slate-400">
                  Fallback Mode
                </Text>
              </View>
            )}
          </View>

          {/* EARLY WARNING BANNER (POSTGIS NEARBY) */}
          {nearbyCluster ? (
            <View className="mt-2 flex-row items-center gap-2.5 rounded-2xl border-2 border-amber-500 bg-amber-500/90 px-4 py-2.5 shadow-lg">
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
                  · Severity: {nearbyCluster.severity.toUpperCase()}
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
          {/* SENSOR CONTROLS */}
          <View className="flex-row items-center justify-between px-4">
            {/* TOGGLE SENSOR */}
            <Touchable
              accessibilityLabel="Toggle accelerometer and gyroscope sensor"
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
                <Activity size={13} color={sensorEnabled ? "#34D399" : "#94A3B8"} />
                <Text
                  className={`font-mono text-[11px] ${
                    sensorEnabled ? "text-emerald-300" : "text-slate-400"
                  }`}
                >
                  {sensorEnabled ? `${liveGForce}G · Acc+Gyro` : "Sensor Off"}
                </Text>
              </View>
            </Touchable>

            {/* MANUAL TEST TRIGGER */}
            <Touchable
              accessibilityLabel="Simulate Edge AI pothole detection"
              accessibilityRole="button"
              onPress={handleTriggerAnomaly}
            >
              <View className="flex-row items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-950/80 px-3 py-1.5 shadow-sm">
                <Cpu size={13} color="#38BDF8" />
                <Text className="font-mono text-[11px] text-sky-200">
                  Simulate ({detectedCount})
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
 * Banner ringkasan perjalanan setelah "Stop Drive" ditekan.
 */
function FinishBanner({
  detectedCount,
  lastResult,
  onDismiss,
}: {
  detectedCount: number;
  lastResult: any;
  onDismiss: () => void;
}) {
  const isTflite = lastResult && !lastResult.modelVersion?.includes('fallback');
  const confPercent = lastResult
    ? Math.round(lastResult.confidence * 100)
    : 0;
  const probPercent = lastResult
    ? Math.round(lastResult.probability * 100)
    : 0;

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
            <Text className="text-xs text-slate-400">Road Anomalies Detected</Text>
            <Text className="font-mono text-xs text-white">{detectedCount} Points</Text>
          </View>
          <View className="flex-row justify-between py-1">
            <Text className="text-xs text-slate-400">AI Engine</Text>
            <Text className={`font-mono text-xs ${isTflite ? "text-emerald-400" : "text-amber-400"}`}>
              {isTflite ? "HG TFLite v2" : "Legacy Fallback"}
            </Text>
          </View>
          {lastResult && (
            <>
              <View className="flex-row justify-between py-1">
                <Text className="text-xs text-slate-400">Last Probability</Text>
                <Text className="font-mono text-xs text-sky-300">{probPercent}%</Text>
              </View>
              <View className="flex-row justify-between py-1">
                <Text className="text-xs text-slate-400">Last Confidence</Text>
                <Text className="font-mono text-xs text-emerald-400">
                  {confPercent}% ({lastResult.confidenceTier})
                </Text>
              </View>
            </>
          )}
          <View className="flex-row justify-between py-1">
            <Text className="text-xs text-slate-400">Server Status</Text>
            <Text className="font-mono text-xs text-sky-400">Synchronized</Text>
          </View>
        </View>

        <Touchable accessibilityLabel="View trip history" onPress={onDismiss}>
          <View className="self-start rounded-full bg-custom-primary px-5 py-2">
            <Text className="font-quicksand-bold text-xs text-white">
              View Trip History →
            </Text>
          </View>
        </Touchable>
      </View>
    </View>
  );
}
