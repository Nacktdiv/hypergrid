import { Text, View } from "react-native";
import { AlertTriangle, Clock, Route } from "lucide-react-native";

import type { Metric } from "./mock-data";

/**
 * Metrics Summary — 3 kartu: Titik Rusak, Jarak Tempuh, Waktu Tempuh.
 * Gaya kartu: putih, border 1px #E2E2E2, radius 24.
 * Semua angka memakai JetBrains Mono.
 */
export function MetricsSummary({ metrics }: { metrics: Metric[] }) {
  return (
    <View className="flex-row gap-2">
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </View>
  )
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <View className="flex-1 justify-between rounded-3xl border border-[#E2E2E2] bg-white p-3 min-w-0">
      {/* Header: Ikon di atas / terpisah agar label punya ruang penuh */}
      <View className="gap-1.5 mb-2">
        <MetricIcon id={metric.id} color={metric.accent} />
        <Text 
          className="text-[11px] font-medium leading-tight text-slate-500" 
          numberOfLines={2}
        >
          {metric.label}
        </Text>
      </View>

      {/* Value & Unit: Fleksibel dan menyesuaikan angka panjang */}
      <View className="flex-row items-baseline gap-0.5 flex-wrap">
        <Text className="font-mono-bold text-xl leading-none text-custom-black">
          {metric.value}
        </Text>
        {metric.unit ? (
          <Text className="text-[10px] font-medium text-slate-400 leading-none">
            {metric.unit}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function MetricIcon({ id, color }: { id: string; color: string }) {
  if (id === "rusak") return <AlertTriangle size={16} color={color} />
  if (id === "jarak") return <Route size={16} color={color} />
  return <Clock size={16} color={color} />
}