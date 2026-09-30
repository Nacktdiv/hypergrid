import { useState } from "react";
import { Text, View } from "react-native";
import { ChevronDown, TriangleAlert } from "lucide-react-native";

import { cn } from "@/lib/utils";
import { Touchable } from "@/components/ui/touchable";

import type { HistoryEntry } from "./mock-data";

/**
 * Satu baris riwayat perjalanan:
 * Lokasi Awal -> Lokasi Akhir, waktu, dan total guncangan terdeteksi.
 * Gaya kartu: putih, border 1px #E2E2E2, radius 24.
 *
 * Interaktif: diketuk untuk membuka/menutup catatan.
 */
export function HistoryItemCard({ entry }: { entry: HistoryEntry }) {
  const [open, setOpen] = useState(false)
  const hasGuncangan = entry.guncangan > 0

  return (
    <View className="rounded-3xl border border-[#E2E2E2] bg-white p-5">
      <Touchable
        accessibilityHint="Buka atau tutup catatan perjalanan"
        accessibilityLabel={`${entry.from} ke ${entry.to}`}
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
      >
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-3">
            <Stop label="Dari" name={entry.from} />
            <Stop label="Ke" name={entry.to} last />
          </View>

          <View className="items-end gap-1">
            <Text className="font-mono text-[11px] text-slate-500">
              {entry.date}
            </Text>
            <Text className="font-mono-bold text-sm text-custom-black">
              {entry.distance}
            </Text>
          </View>
        </View>
      </Touchable>

      <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-4">
        <Text className="text-sm text-slate-500">{entry.time}</Text>

        <View className="flex-row items-center gap-2">
          <View
            className={cn(
              "flex-row items-center gap-1.5 rounded-full px-3 py-1.5",
              hasGuncangan ? "bg-red-50" : "bg-slate-100"
            )}
          >
            <TriangleAlert
              size={12}
              color={hasGuncangan ? "#EF4444" : "#94A3B8"}
            />
            <Text
              className={cn(
                "font-mono text-[11px]",
                hasGuncangan ? "text-custom-danger" : "text-slate-500"
              )}
            >
              {entry.guncangan} guncangan
            </Text>
          </View>

          <ChevronDown
            size={16}
            color="#94A3B8"
            style={{
              transform: [{ rotate: open ? "180deg" : "0deg" }],
            }}
          />
        </View>
      </View>

      {open ? (
        <View className="mt-3 rounded-2xl bg-slate-50 p-3">
          <Text className="text-xs leading-5 text-slate-600">{entry.note}</Text>
        </View>
      ) : null}
    </View>
  )
}

function Stop({ label, name, last }: { label: string; name: string; last?: boolean }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="items-center gap-1">
        <View
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            last ? "bg-custom-primary" : "bg-slate-300"
          )}
        />
        {!last ? <View className="h-4 w-px bg-slate-200" /> : null}
      </View>

      <View className="flex-1 flex-row items-baseline gap-2">
        <Text className="text-[10px] uppercase text-slate-400">{label}</Text>
        <Text className="flex-1 text-sm text-custom-black" numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  )
}
