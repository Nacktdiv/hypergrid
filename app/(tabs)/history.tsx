import { useState, useCallback, useMemo, useRef } from "react";
import {
  InteractionManager,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Compass,
  Navigation,
  RefreshCw,
} from "lucide-react-native";

import { DaySelector } from "@/components/history/day-selector";
import { HistoryItemCard } from "@/components/history/history-item-card";
import { MetricsSummary } from "@/components/history/metrics-summary";
import { RouteMapPreview } from "@/components/history/route-map-preview";
import {
  formatToIsoDate,
  formatIsoToLongLabel,
} from "@/components/history/date-utils";
import type { HistoryEntry, Metric } from "@/components/history/mock-data";
import type { DamagePoint, LatLng } from "@/components/map/map-data";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { HistoryContentSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useDetections } from "@/hooks/use-detections";
import { historyStorage } from "@/services/api/history-storage";
import { tokenStorage } from "@/services/api/token-storage";

/**
 * Screen 7 — Riwayat Perjalanan (Swiss Design & Data Riil Server).
 *
 * Arsitektur Transisi Instan + In-Memory useState / Storage Cache:
 *   - Menggunakan data yang sudah ada di memori (`historyStorage.getMemoryCache()` / `useState`)
 *     agar perpindahan antar tab (`Start` <-> `History` <-> `Profile`) instan (0 ms) dan hemat resource.
 *   - Menampilkan Skeleton Loader hanya jika cache belum tersedia atau saat berpindah tanggal.
 */
export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Tanggal terpilih (format ISO: YYYY-MM-DD, default hari ini)
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    formatToIsoDate(new Date())
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSkeletonVisible, setIsSkeletonVisible] = useState<boolean>(
    () => historyStorage.getMemoryCache() === null
  );
  const fetchRequestIdRef = useRef(0);
  const dateSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    detections,
    isLoading: isDetectionsLoading,
    fetchDetections,
  } = useDetections();

  const loadDataFromBackend = useCallback(
    async (showSkeleton = false) => {
      const requestId = ++fetchRequestIdRef.current;
      if (showSkeleton) {
        setIsSkeletonVisible(true);
      }
      try {
        const deviceId = await tokenStorage.getDeviceId();
        await fetchDetections({
          limit: 100,
          userId: user?.id,
          deviceId: !user?.id ? deviceId : undefined,
        });
      } catch (e) {
        console.warn("[HistoryScreen] Gagal memuat data telemetri:", e);
      } finally {
        if (fetchRequestIdRef.current === requestId) {
          setIsSkeletonVisible(false);
        }
      }
    },
    [fetchDetections, user]
  );

  // Saat masuk ke halaman History:
  // Jika data sudah ada di memoryCache / useState, tampilkan langsung (0ms) tanpa skeleton berat.
  // Sinkronisasi background hanya dijalankan jika cache belum pernah di-sync dalam 25 detik terakhir.
  useFocusEffect(
    useCallback(() => {
      const hasMemoryCache = historyStorage.getMemoryCache() !== null;
      const isCacheFresh =
        hasMemoryCache && Date.now() - historyStorage.getLastSyncedAt() < 25_000;

      if (!hasMemoryCache) {
        setIsSkeletonVisible(true);
      } else {
        setIsSkeletonVisible(false);
      }

      const task = InteractionManager.runAfterInteractions(() => {
        if (!isCacheFresh) {
          loadDataFromBackend(!hasMemoryCache);
        }
      });

      return () => {
        task.cancel();
        if (dateSwitchTimerRef.current) {
          clearTimeout(dateSwitchTimerRef.current);
          dateSwitchTimerRef.current = null;
        }
      };
    }, [loadDataFromBackend])
  );

  // Saat user memilih tanggal baru: langsung ubah tanggal aktif & tampilkan skeleton singkat,
  // lalu gunakan data di useState/storage (atau revalidate jika cache belum pernah di-sync)
  const handleSelectDate = useCallback(
    (newDate: string) => {
      if (newDate === selectedDate && !isSkeletonVisible) return;
      setSelectedDate(newDate);
      setIsSkeletonVisible(true);

      if (dateSwitchTimerRef.current) {
        clearTimeout(dateSwitchTimerRef.current);
      }

      const isCacheFresh =
        historyStorage.getMemoryCache() !== null &&
        Date.now() - historyStorage.getLastSyncedAt() < 30_000;

      if (isCacheFresh) {
        dateSwitchTimerRef.current = setTimeout(() => {
          setIsSkeletonVisible(false);
        }, 140);
        return;
      }

      const requestId = ++fetchRequestIdRef.current;
      InteractionManager.runAfterInteractions(async () => {
        try {
          const deviceId = await tokenStorage.getDeviceId();
          await fetchDetections({
            limit: 100,
            userId: user?.id,
            deviceId: !user?.id ? deviceId : undefined,
          });
        } catch (e) {
          console.warn("[HistoryScreen] Gagal memuat data tanggal:", e);
        } finally {
          if (fetchRequestIdRef.current === requestId) {
            setIsSkeletonVisible(false);
          }
        }
      });
    },
    [selectedDate, isSkeletonVisible, fetchDetections, user]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDataFromBackend(true);
    setIsRefreshing(false);
  };

  // 1. FILTER DATA DETEKSI ANOMALI NYATA KHUSUS PADA TANGGAL YANG DIPILIH
  const detectionsOnDate = useMemo(() => {
    if (isSkeletonVisible) return [];
    return detections.filter((d) => {
      if (user?.id && d.userId && d.userId !== user.id) return false;
      if (!d.detectedAt) return false;
      if (String(d.id).startsWith("ride_")) return false;
      if (typeof d.confidence === "number" && d.confidence <= 0) return false;
      if (typeof d.speedKmh === "number" && d.speedKmh < 3.5) return false;
      if (typeof d.zAccelPeak === "number" && d.zAccelPeak < 0.6) return false;

      const dateObj = new Date(d.detectedAt);
      if (isNaN(dateObj.getTime())) return false;
      return formatToIsoDate(dateObj) === selectedDate;
    });
  }, [detections, selectedDate, user, isSkeletonVisible]);

  const hasTripOnDate = detectionsOnDate.length > 0;

  // 2. SUSUN RUTE & TITIK KERUSAKAN NYATA UNTUK PETA
  const { realRouteCoordinates, realDamagePoints } = useMemo(() => {
    if (!hasTripOnDate) {
      return { realRouteCoordinates: [], realDamagePoints: [] };
    }

    const coords: LatLng[] = detectionsOnDate.map((d) => ({
      latitude: d.latitude,
      longitude: d.longitude,
    }));

    const damagePts: DamagePoint[] = detectionsOnDate.map((d) => ({
      id: d.id,
      position: { latitude: d.latitude, longitude: d.longitude },
      severity:
        d.zAccelPeak && d.zAccelPeak >= 2.2
          ? "high"
          : d.zAccelPeak && d.zAccelPeak >= 1.7
          ? "medium"
          : "low",
      reportCount: 1,
    }));

    return {
      realRouteCoordinates: coords,
      realDamagePoints: damagePts,
    };
  }, [hasTripOnDate, detectionsOnDate]);

  // 3. METRIK SWISS DESIGN BERDASARKAN DATA NYATA
  const dynamicMetrics: Metric[] = useMemo(() => {
    if (!hasTripOnDate) {
      return [
        {
          id: "rusak",
          label: "Anomaly Points",
          value: "0",
          unit: "locations",
          accent: "#38BDF8",
        },
        {
          id: "confidence",
          label: "Avg AI Confidence",
          value: "0%",
          unit: "AI",
          accent: "#009EFF",
        },
        {
          id: "peak",
          label: "G-Force Peak",
          value: "0.0",
          unit: "G",
          accent: "#1D4ED8",
        },
      ];
    }

    const count = detectionsOnDate.length;
    const avgConfidence = (
      (detectionsOnDate.reduce((acc, d) => acc + (d.confidence || 0), 0) /
        count) *
      100
    ).toFixed(0);

    const maxPeak = Math.max(
      ...detectionsOnDate.map((d) => d.zAccelPeak || 0),
      0
    ).toFixed(1);

    return [
      {
        id: "rusak",
        label: "Anomaly Points",
        value: String(count),
        unit: "locations",
        accent: "#38BDF8",
      },
      {
        id: "confidence",
        label: "Avg AI Confidence",
        value: `${avgConfidence}%`,
        unit: "Score",
        accent: "#009EFF",
      },
      {
        id: "peak",
        label: "G-Force Peak",
        value: `${maxPeak}G`,
        unit: "Z-Peak",
        accent: "#1D4ED8",
      },
    ];
  }, [hasTripOnDate, detectionsOnDate]);

  // 4. DAFTAR ITEM RIWAYAT NYATA
  const historyEntries: HistoryEntry[] = useMemo(() => {
    return detectionsOnDate.map((det) => {
      const dateObj = new Date(det.detectedAt);
      const timeStr = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : "N/A";

      const confPct = Math.round((det.confidence || 0) * 100);
      const zPeak = det.zAccelPeak
        ? `${det.zAccelPeak.toFixed(2)}G`
        : "Normal";
      const speed = det.speedKmh ? `${det.speedKmh.toFixed(0)} km/h` : "0 km/h";

      return {
        id: det.id,
        from: `Coordinates [${det.latitude.toFixed(4)}, ${det.longitude.toFixed(4)}]`,
        to: `Device: ${det.deviceId || "Edge Mobile"}`,
        time: timeStr,
        date: selectedDate,
        guncangan: det.zAccelPeak && det.zAccelPeak >= 1.7 ? 1 : 0,
        distance: speed,
        note: `Model ${det.modelVersion || "v1"} • AI Confidence: ${confPct}% • Peak Gravity: ${zPeak} • Coordinates: [${det.latitude.toFixed(4)}, ${det.longitude.toFixed(4)}]`,
      };
    });
  }, [detectionsOnDate, selectedDate]);

  const showSkeleton = isSkeletonVisible || isDetectionsLoading;

  return (
    <SafeAreaView className="flex-1 bg-surface-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pt-2 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#009EFF"]}
            tintColor="#009EFF"
          />
        }
      >
        {/* HEADER */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-chivo-bold text-2xl text-slate-900">History</Text>
            <Text className="font-quicksand text-xs text-slate-600 mt-0.5">
              Driving telemetry and detected road anomalies
            </Text>
          </View>
          <AppButton
            variant="circle"
            size="sm"
            onPress={handleRefresh}
            loading={isRefreshing}
            iconLeft={<RefreshCw size={18} color="#334155" />}
            accessibilityLabel="Synchronize telemetry data"
          />
        </View>

        {/* PEMILIH HARI INTUITIF (7 HARI TERAKHIR + TOMBOL KALENDER) */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700">
              Select Date:
            </Text>
            <Text className="font-mono text-[11px] text-brand">
              {formatIsoToLongLabel(selectedDate)}
            </Text>
          </View>

          <DaySelector
            onSelect={handleSelectDate}
            selectedId={selectedDate}
          />
        </View>

        {/* TAMPILKAN SKELETON SAAT PINDAH HALAMAN ATAU GANTI TANGGAL & SEDANG FETCH */}
        {showSkeleton ? (
          <HistoryContentSkeleton />
        ) : (
          <>
            {/* RINGKASAN METRIK TELEMETRI */}
            <MetricsSummary metrics={dynamicMetrics} />

            {/* TAMPILAN PETA RIWAYAT: HANYA TAMPIL JIKA ADA DATA PERJALANAN NYATA */}
            {hasTripOnDate ? (
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
                    Route Preview
                  </Text>
                  <Text className="font-mono text-xs text-slate-600">
                    {realRouteCoordinates.length} Coordinates
                  </Text>
                </View>

                <RouteMapPreview
                  routeCoordinates={realRouteCoordinates}
                  damagePoints={realDamagePoints}
                />
              </View>
            ) : (
              /* EMPTY STATE BERBASIS DESIGN SYSTEM */
              <AppCard variant="default" className="p-5 gap-3">
                <View className="gap-1">
                  <Text className="font-chivo-bold text-lg text-slate-900">
                    No Driving Activity Detected
                  </Text>
                  <Text className="font-quicksand text-xs leading-relaxed text-slate-700">
                    No driving activity or road shock anomaly detections recorded on{" "}
                    <Text className="font-mono-bold text-slate-900">
                      {formatIsoToLongLabel(selectedDate)}
                    </Text>
                    . Map preview is hidden as no GPS telemetry routes were logged.
                  </Text>
                </View>

                {/* Metric Preview Row */}
                <View className="flex-row divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50 p-3 mt-2">
                  <View className="flex-1 items-center gap-0.5">
                    <Text className="font-mono text-[9px] uppercase font-bold text-slate-600">
                      Anomaly Points
                    </Text>
                    <Text className="font-mono-bold text-sm text-slate-900">
                      0
                    </Text>
                  </View>
                  <View className="flex-1 items-center gap-0.5">
                    <Text className="font-mono text-[9px] uppercase font-bold text-slate-600">
                      Distance
                    </Text>
                    <Text className="font-mono-bold text-sm text-slate-900">
                      0.0 KM
                    </Text>
                  </View>
                  <View className="flex-1 items-center gap-0.5">
                    <Text className="font-mono text-[9px] uppercase font-bold text-slate-600">
                      Sensor Status
                    </Text>
                    <Text className="font-mono-bold text-sm text-slate-900">
                      IDLE
                    </Text>
                  </View>
                </View>

                {/* Call To Action */}
                <View className="mt-2">
                  <AppButton
                    variant="primary"
                    size="md"
                    label="Start Drive Mode Now"
                    iconLeft={<Navigation size={16} color="#FFFFFF" />}
                    onPress={() => router.push("/ride")}
                    accessibilityLabel="Start drive mode"
                  />
                </View>
              </AppCard>
            )}

            {/* DAFTAR LOG DETAIL PERJALANAN */}
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-baseline gap-2">
                  <Text className="font-chivo-bold text-lg uppercase tracking-tight text-slate-900">
                    Telemetry Log Entries
                  </Text>
                  <Text className="font-mono text-[11px] text-slate-600 font-semibold">
                    {hasTripOnDate
                      ? `${historyEntries.length} points`
                      : "0 entries"}
                  </Text>
                </View>
              </View>

              {/* List Log Items */}
              {historyEntries.length > 0 ? (
                historyEntries.map((entry) => (
                  <HistoryItemCard key={entry.id} entry={entry} />
                ))
              ) : (
                <View className="items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-8">
                  <Compass size={24} color="#64748B" />
                  <Text className="mt-2 font-quicksand-semibold text-xs text-slate-700">
                    No telemetry logs recorded for this date.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
