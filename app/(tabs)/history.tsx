import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DAYS, DEFAULT_DAY_ID, HISTORY_BY_DAY, METRICS_BY_DAY } from "@/components/history/mock-data";
import { DaySelector } from "@/components/history/day-selector";
import { HistoryItemCard } from "@/components/history/history-item-card";
import { MetricsSummary } from "@/components/history/metrics-summary";
import { RouteMapPreview } from "@/components/history/route-map-preview";

/**
 * Screen 7 — Riwayat Perjalanan.
 *
 * Design language: Figma page "Final Page Mobile"
 * (page itu tidak punya frame History; komponen disusun dari `Main page`
 * #114:1267 + `Profile` #114:1309 dengan konten sesuai spec).
 *
 * Interaktif: pemilih hari mengubah metrik dan daftar rute.
 * Data tetap konstanta dummy per hari — tanpa API, tanpa perhitungan.
 * Bottom navigation ditangani oleh `app/(tabs)/_layout.tsx`.
 */
export default function HistoryScreen() {
  const [dayId, setDayId] = useState(DEFAULT_DAY_ID)

  const day = DAYS.find((item) => item.id === dayId)
  const metrics = METRICS_BY_DAY[dayId] ?? []
  const entries = HISTORY_BY_DAY[dayId] ?? []

  return (
    <SafeAreaView className="flex-1 bg-custom-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-chivo-bold text-xl text-black">
          Riwayat Perjalanan
        </Text>

        <DaySelector onSelect={setDayId} selectedId={dayId} />

        <MetricsSummary metrics={metrics} />

        <RouteMapPreview />

        <View className="gap-4">
          <View className="gap-1">
            <Text className="font-chivo-bold text-lg text-[#1C1C1E]">
              Detail Perjalanan
            </Text>
            {day ? (
              <Text className="text-xs text-slate-500">{day.longLabel}</Text>
            ) : null}
          </View>

          {entries.length > 0 ? (
            entries.map((entry) => (
              <HistoryItemCard key={entry.id} entry={entry} />
            ))
          ) : (
            <View className="rounded-3xl border border-[#E2E2E2] bg-white p-5">
              <Text className="text-sm text-slate-500">
                Belum ada perjalanan pada hari ini.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
