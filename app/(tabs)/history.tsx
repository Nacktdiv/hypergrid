import { useRouter } from "expo-router";
import { Compass, Navigation, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { InteractionManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  formatIsoToLongLabel,
  formatToIsoDate,
} from "@/components/history/date-utils";
import { DaySelector } from "@/components/history/day-selector";
import { HistoryItemCard } from "@/components/history/history-item-card";
import { MetricsSummary } from "@/components/history/metrics-summary";
import type { HistoryEntry, Metric } from "@/components/history/mock-data";
import { RouteMapPreview } from "@/components/history/route-map-preview";
import type { DamagePoint, LatLng } from "@/components/map/map-data";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { HistoryContentSkeleton } from "@/components/ui/skeleton";
import { useAppTheme } from "@/contexts/theme-context";
import { useAuth } from "@/hooks/use-auth";
import { useDetections } from "@/hooks/use-detections";
import { historyStorage } from "@/services/api/history-storage";
import { tokenStorage } from "@/services/api/token-storage";
import { tripStorage, type SavedTripRecord } from "@/services/api/trip-storage";

/**
 * Trip History & Telemetry Logs (FlatList virtualized + Light/Dark themed).
 */
export default function HistoryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    formatToIsoDate(new Date())
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSkeletonVisible, setIsSkeletonVisible] = useState<boolean>(
    () => historyStorage.getMemoryCache() === null
  );
  const [savedTrips, setSavedTrips] = useState<SavedTripRecord[]>(
    () => tripStorage.getMemoryCache() || []
  );
  const fetchRequestIdRef = useRef(0);
  const dateSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    tripStorage
      .getTrips()
      .then(setSavedTrips)
      .catch(() => {});
    const unsub = tripStorage.subscribe(setSavedTrips);
    return unsub;
  }, []);

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

  useEffect(() => {
    const hasMemoryCache = historyStorage.getMemoryCache() !== null;
    const isCacheFresh =
      hasMemoryCache && Date.now() - historyStorage.getLastSyncedAt() < 25_000;

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
  }, [loadDataFromBackend]);

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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDataFromBackend(true);
    setIsRefreshing(false);
  }, [loadDataFromBackend]);

  const tripsOnDate = useMemo(() => {
    return savedTrips.filter((t) => {
      const dateObj = new Date(t.startTime);
      if (isNaN(dateObj.getTime())) return false;
      return formatToIsoDate(dateObj) === selectedDate;
    });
  }, [savedTrips, selectedDate]);

  const detectionsOnDate = useMemo(() => {
    if (isSkeletonVisible) return [];
    return detections.filter((d) => {
      if (user?.id && d.userId && d.userId !== user.id) return false;
      if (!d.detectedAt) return false;
      if (String(d.id).startsWith("ride_")) return false;
      if (typeof d.confidence === "number" && d.confidence <= 0) return false;
      if (typeof d.speedKmh === "number" && d.speedKmh < 1.5) return false;
      if (typeof d.zAccelPeak === "number" && d.zAccelPeak < 0.6) return false;

      const dateObj = new Date(d.detectedAt);
      if (isNaN(dateObj.getTime())) return false;
      return formatToIsoDate(dateObj) === selectedDate;
    });
  }, [detections, selectedDate, user, isSkeletonVisible]);

  const hasTripOnDate = tripsOnDate.length > 0 || detectionsOnDate.length > 0;

  const { realRouteCoordinates, realDamagePoints } = useMemo(() => {
    if (!hasTripOnDate) {
      return { realRouteCoordinates: [], realDamagePoints: [] };
    }

    const coords: LatLng[] = [];

    for (const trip of tripsOnDate) {
      if (trip.startCoords) coords.push(trip.startCoords);
      if (trip.destinationCoords) coords.push(trip.destinationCoords);
    }

    for (const d of detectionsOnDate) {
      coords.push({ latitude: d.latitude, longitude: d.longitude });
    }

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
  }, [hasTripOnDate, tripsOnDate, detectionsOnDate]);

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
          accent: colors.brand,
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

    const totalAnomalies =
      tripsOnDate.reduce((sum, t) => sum + (t.anomalyCount || 0), 0) +
      (tripsOnDate.length === 0 ? detectionsOnDate.length : 0);

    const count = detectionsOnDate.length;
    const avgConfidence =
      count > 0
        ? (
            (detectionsOnDate.reduce((acc, d) => acc + (d.confidence || 0), 0) /
              count) *
            100
          ).toFixed(0)
        : tripsOnDate.length > 0
          ? "92"
          : "0";

    const maxPeak = Math.max(
      ...detectionsOnDate.map((d) => d.zAccelPeak || 0),
      ...tripsOnDate.map((t) => t.maxGForce || 0),
      0
    ).toFixed(1);

    return [
      {
        id: "rusak",
        label: "Anomaly Points",
        value: String(totalAnomalies),
        unit: "locations",
        accent: "#38BDF8",
      },
      {
        id: "confidence",
        label: "Avg AI Confidence",
        value: `${avgConfidence}%`,
        unit: "Score",
        accent: colors.brand,
      },
      {
        id: "peak",
        label: "G-Force Peak",
        value: `${maxPeak}G`,
        unit: "Z-Peak",
        accent: "#1D4ED8",
      },
    ];
  }, [hasTripOnDate, tripsOnDate, detectionsOnDate, colors.brand]);

  const historyEntries: HistoryEntry[] = useMemo(() => {
    const list: HistoryEntry[] = [];

    for (const trip of tripsOnDate) {
      const startObj = new Date(trip.startTime);
      const endObj = new Date(trip.endTime);
      const startStr = !isNaN(startObj.getTime())
        ? startObj.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "00:00";
      const endStr = !isNaN(endObj.getTime())
        ? endObj.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "00:00";

      const distStr =
        trip.distanceMeters >= 1000
          ? `${(trip.distanceMeters / 1000).toFixed(1)} KM`
          : `${Math.round(trip.distanceMeters)} M`;

      list.push({
        id: trip.id,
        from: trip.startLocationName || "Origin Location",
        to: trip.destinationName || "Destination",
        time: `${startStr} - ${endStr}`,
        date: selectedDate,
        guncangan: trip.anomalyCount,
        distance: distStr,
        note: `Vehicle: ${trip.vehicleName || "Vehicle"} (${trip.vehiclePlate || "Active"}) • Road Quality: ${trip.roadScore}/100 • Max G-Force: ${trip.maxGForce.toFixed(2)}G • Road Hazards: ${trip.anomalyCount}`,
      });
    }

    if (list.length === 0) {
      for (const det of detectionsOnDate) {
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
        const speed = det.speedKmh
          ? `${det.speedKmh.toFixed(0)} km/h`
          : "0 km/h";

        list.push({
          id: det.id,
          from: `Coordinates [${det.latitude.toFixed(4)}, ${det.longitude.toFixed(4)}]`,
          to: `Device: ${det.deviceId || "Edge Mobile"}`,
          time: timeStr,
          date: selectedDate,
          guncangan: det.zAccelPeak && det.zAccelPeak >= 1.7 ? 1 : 0,
          distance: speed,
          note: `Model ${det.modelVersion || "v1"} • AI Confidence: ${confPct}% • Peak Gravity: ${zPeak} • Coordinates: [${det.latitude.toFixed(4)}, ${det.longitude.toFixed(4)}]`,
        });
      }
    }

    return list;
  }, [tripsOnDate, detectionsOnDate, selectedDate]);

  const showSkeleton = isSkeletonVisible || isDetectionsLoading;

  const keyExtractor = useCallback((item: HistoryEntry) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<HistoryEntry>) => (
      <HistoryItemCard entry={item} />
    ),
    []
  );

  const renderSeparator = useCallback(
    () => <View style={{ height: 12 }} />,
    []
  );

  const handleStartRide = useCallback(() => {
    router.push("/ride");
  }, [router]);

  const listHeader = useMemo(
    () => (
      <View className="gap-5 mb-3">
        <View className="flex-row items-center justify-between pt-1">
          <View className="flex-1 pr-3">
            <Text
              className="font-inter-extrabold text-2xl tracking-tight"
              style={{ color: colors.text }}
            >
              History
            </Text>
            <Text
              className="font-inter text-xs mt-0.5"
              style={{ color: colors.textMuted }}
            >
              Driving telemetry and detected road anomalies
            </Text>
          </View>

          <AppButton
            variant="circle"
            size="sm"
            onPress={handleRefresh}
            loading={isRefreshing}
            iconLeft={<RefreshCw size={18} color={colors.text} />}
            accessibilityLabel="Synchronize telemetry data"
          />
        </View>

        <DaySelector onSelect={handleSelectDate} selectedId={selectedDate} />

        {showSkeleton ? (
          <HistoryContentSkeleton />
        ) : (
          <View className="gap-5">
            <MetricsSummary metrics={dynamicMetrics} />

            {hasTripOnDate ? (
              <RouteMapPreview
                routeCoordinates={realRouteCoordinates}
                damagePoints={realDamagePoints}
              />
            ) : (
              <AppCard
                variant="default"
                className="p-5 gap-3"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <View className="gap-1">
                  <Text
                    className="font-inter-bold text-lg"
                    style={{ color: colors.text }}
                  >
                    No Driving Activity Detected
                  </Text>
                  <Text
                    className="font-inter text-xs leading-5"
                    style={{ color: colors.textSecondary }}
                  >
                    No driving activity or road shock anomaly detections
                    recorded on{" "}
                    <Text
                      className="font-mono-bold"
                      style={{ color: colors.text }}
                    >
                      {formatIsoToLongLabel(selectedDate)}
                    </Text>
                    . Map preview is hidden as no GPS telemetry routes were
                    logged.
                  </Text>
                </View>

                <View
                  className="flex-row rounded-2xl border p-3 mt-1"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    className="flex-1 items-center gap-0.5 border-r"
                    style={{ borderRightColor: colors.border }}
                  >
                    <Text
                      className="font-mono text-[9px] uppercase font-bold"
                      style={{ color: colors.textMuted }}
                    >
                      Anomaly Points
                    </Text>
                    <Text
                      className="font-mono-bold text-sm"
                      style={{ color: colors.text }}
                    >
                      0
                    </Text>
                  </View>
                  <View
                    className="flex-1 items-center gap-0.5 border-r"
                    style={{ borderRightColor: colors.border }}
                  >
                    <Text
                      className="font-mono text-[9px] uppercase font-bold"
                      style={{ color: colors.textMuted }}
                    >
                      Distance
                    </Text>
                    <Text
                      className="font-mono-bold text-sm"
                      style={{ color: colors.text }}
                    >
                      0.0 KM
                    </Text>
                  </View>
                  <View className="flex-1 items-center gap-0.5">
                    <Text
                      className="font-mono text-[9px] uppercase font-bold"
                      style={{ color: colors.textMuted }}
                    >
                      Sensor Status
                    </Text>
                    <Text
                      className="font-mono-bold text-sm"
                      style={{ color: colors.text }}
                    >
                      IDLE
                    </Text>
                  </View>
                </View>

                <View className="mt-1">
                  <AppButton
                    variant="primary"
                    size="md"
                    label="Start Drive Mode Now"
                    iconLeft={<Navigation size={16} color="#FFFFFF" />}
                    onPress={handleStartRide}
                    accessibilityLabel="Start drive mode"
                  />
                </View>
              </AppCard>
            )}

            {historyEntries.length > 0 ? (
              <View className="flex-row items-center justify-between pt-1">
                <Text
                  className="font-inter-bold text-sm"
                  style={{ color: colors.text }}
                >
                  Telemetry Logs
                </Text>
                <Text
                  className="font-mono-bold text-xs"
                  style={{ color: colors.textMuted }}
                >
                  {historyEntries.length}{" "}
                  {historyEntries.length === 1 ? "entry" : "entries"}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    ),
    [
      colors,
      handleRefresh,
      isRefreshing,
      handleSelectDate,
      selectedDate,
      showSkeleton,
      dynamicMetrics,
      hasTripOnDate,
      realRouteCoordinates,
      realDamagePoints,
      handleStartRide,
      historyEntries.length,
    ]
  );

  const listEmpty = useMemo(() => {
    if (showSkeleton) return null;
    return (
      <View
        className="items-center justify-center rounded-3xl border border-dashed py-8 px-4"
        style={{
          backgroundColor: colors.card,
          borderColor: colors.borderStrong,
        }}
      >
        <Compass size={24} color={colors.textMuted} />
        <Text
          className="mt-2 font-inter-semibold text-xs text-center"
          style={{ color: colors.textSecondary }}
        >
          No telemetry logs recorded for this date.
        </Text>
      </View>
    );
  }, [showSkeleton, colors]);

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.canvas }}
      edges={["top"]}
    >
      <FlatList
        data={showSkeleton ? [] : historyEntries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={renderSeparator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.brand]}
            tintColor={colors.brand}
          />
        }
      />
    </SafeAreaView>
  );
}
