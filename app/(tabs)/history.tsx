import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
import { Touchable } from "@/components/ui/touchable";
import { useAuth } from "@/hooks/use-auth";
import { useDetections } from "@/hooks/use-detections";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";

/**
 * Screen 7 — Riwayat Perjalanan (Swiss Design & Data Riil Server).
 *
 * Mengusung gaya International Typographic Style (Swiss Design):
 *   - Grid asimetris fungsional, kontras hitam-putih tegas
 *   - Tipografi sans-serif dominan (Chivo & JetBrains Mono)
 *   - Data-dense & bebas dari elemen dekorasi palsu (NO DUMMY MAPS)
 *   - Pemilihan 7 hari dinamis dari hari ini + Kalender Rentang Tanggal
 *   - Setiap user hanya melihat data riwayat akunnya sendiri (Role User Driver, bukan Admin)
 *   - Jika tidak ada perjalanan pada tanggal itu: Tampilkan Swiss Empty State
 */
export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Tanggal terpilih (format ISO: YYYY-MM-DD, default hari ini)
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    formatToIsoDate(new Date())
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    detections,
    isLoading: isDetectionsLoading,
    fetchDetections,
  } = useDetections();

  const {
    fetchClusters,
  } = usePotholeClusters();

  const loadData = useCallback(async () => {
    try {
      await Promise.allSettled([
        fetchDetections({ limit: 100, userId: user?.id }),
        fetchClusters({ limit: 100 }),
      ]);
    } catch (e) {
      console.warn("[HistoryScreen] Gagal memuat data telemetri:", e);
    }
  }, [fetchDetections, fetchClusters, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  // 1. FILTER DATA DETEKSI TELEMETRI KHUSUS PADA TANGGAL YANG DIPILIH
  // HANYA menampilkan riwayat akun sendiri (bukan akun admin / user lain)
  const detectionsOnDate = useMemo(() => {
    return detections.filter((d) => {
      // Pastikan hanya data akun sendiri jika user terautentikasi
      if (user?.id && d.userId && d.userId !== user.id) return false;
      if (!d.detectedAt) return false;
      return d.detectedAt.startsWith(selectedDate);
    });
  }, [detections, selectedDate, user]);

  const hasTripOnDate = detectionsOnDate.length > 0;

  // 2. SUSUN RUTE & TITIK KERUSAKAN NYATA UNTUK PETA (BUKAN DUMMY!)
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
          accent: "#0F172A",
        },
        {
          id: "confidence",
          label: "Avg AI Confidence",
          value: "0%",
          unit: "AI",
          accent: "#64748B",
        },
        {
          id: "peak",
          label: "G-Force Peak",
          value: "0.0",
          unit: "G",
          accent: "#94A3B8",
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
        accent: "#E11D48",
      },
      {
        id: "confidence",
        label: "Avg AI Confidence",
        value: `${avgConfidence}%`,
        unit: "Score",
        accent: "#0052FF",
      },
      {
        id: "peak",
        label: "G-Force Peak",
        value: `${maxPeak}G`,
        unit: "Z-Peak",
        accent: "#F59E0B",
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

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pt-4 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#0F172A"]}
            tintColor="#0F172A"
          />
        }
      >
        <Text className="font-chivo-bold text-xl text-black">History</Text>
        {/* SWISS DESIGN HEADER */}

        {/* PEMILIH HARI INTUITIF (7 HARI TERAKHIR + TOMBOL KALENDER) */}
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Date: 
            </Text>
            <Touchable onPress={handleRefresh}>
              <View className="flex-row items-center gap-1">
                <RefreshCw size={11} color="#64748B" />
                <Text className="font-mono text-[10px] text-slate-500">
                  Synchronize
                </Text>
              </View>
            </Touchable>
          </View>

          <DaySelector
            onSelect={setSelectedDate}
            selectedId={selectedDate}
          />
        </View>

        {/* RINGKASAN METRIK TELEMETRI */}
        <MetricsSummary metrics={dynamicMetrics} />

        {/* TAMPILAN PETA RIWAYAT: HANYA TAMPIL JIKA ADA DATA PERJALANAN NYATA */}
        {hasTripOnDate ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
                Route Preview
              </Text>
              <Text className="font-mono text-xs text-slate-500">
                {realRouteCoordinates.length} Coordinates
              </Text>
            </View>

            <RouteMapPreview
              routeCoordinates={realRouteCoordinates}
              damagePoints={realDamagePoints}
            />
          </View>
        ) : (
          /* SWISS DESIGN EMPTY STATE: TIDAK ADA PERJALANAN PADA HARI INI */
          <View className="rounded-3xl border-2 border-slate-900 bg-white p-6 shadow-sm">
            <View className="gap-2">
              <Text className="font-chivo-bold text-xl uppercase tracking-tight text-slate-950">
                No Driving Activity Detected
              </Text>
              <Text className="font-quicksand text-xs leading-relaxed text-slate-600">
                No driving activity or road shock anomaly detections recorded on{" "}
                <Text className="font-mono-bold text-slate-900">
                  {formatIsoToLongLabel(selectedDate)}
                </Text>
                . Map preview is hidden as no GPS telemetry routes were logged.
              </Text>
            </View>

            {/* Swiss Grid Info */}
            <View className="flex-row divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50 p-3 mt-5">
              <View className="flex-1 items-center gap-0.5">
                <Text className="font-mono text-[9px] uppercase text-slate-400">
                  Anomaly Points
                </Text>
                <Text className="font-mono-bold text-sm text-slate-800">
                  0
                </Text>
              </View>
              <View className="flex-1 items-center gap-0.5">
                <Text className="font-mono text-[9px] uppercase text-slate-400">
                  Distance
                </Text>
                <Text className="font-mono-bold text-sm text-slate-800">
                  0.0 KM
                </Text>
              </View>
              <View className="flex-1 items-center gap-0.5">
                <Text className="font-mono text-[9px] uppercase text-slate-400">
                  Sensor Status
                </Text>
                <Text className="font-mono-bold text-sm text-slate-800">
                  IDLE
                </Text>
              </View>
            </View>

            {/* Call To Action Swiss Design */}
            <View className="mt-5">
              <Touchable onPress={() => router.push("/ride")}>
                <View className="flex-row items-center justify-center gap-2 rounded-2xl border-2 border-slate-900 bg-slate-900 py-3.5 shadow-md">
                  <Navigation size={16} color="#FFFFFF" />
                  <Text className="font-chivo-bold text-xs uppercase tracking-wider text-white">
                    Start Drive Mode Now
                  </Text>
                </View>
              </Touchable>
            </View>
          </View>
        )}

        {/* DAFTAR LOG DETAIL PERJALANAN */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-baseline gap-2">
              <Text className="font-chivo-bold text-lg uppercase tracking-tight text-slate-900">
                Telemetry Log Entries
              </Text>
              <Text className="font-mono text-[11px] text-slate-500">
                {hasTripOnDate
                  ? `${historyEntries.length} points`
                  : "0 entries"}
              </Text>
            </View>

            {isDetectionsLoading ? (
              <ActivityIndicator size="small" color="#0F172A" />
            ) : null}
          </View>

          {/* List Log Items */}
          {historyEntries.length > 0 ? (
            historyEntries.map((entry) => (
              <HistoryItemCard key={entry.id} entry={entry} />
            ))
          ) : (
            <View className="items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-8">
              <Compass size={24} color="#94A3B8" />
              <Text className="mt-2 font-mono text-xs text-slate-500">
                No telemetry logs recorded for this date.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
