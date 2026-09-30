import { ScrollView, Text, View } from "react-native";

import { cn } from "@/lib/utils";
import { Touchable } from "@/components/ui/touchable";

import { DAYS, type DayOption } from "./mock-data";

/**
 * Horizontal Scroll Tab "7 Hari Terakhir".
 *
 * Pill aktif = biru solid custom.primary (#009EFF) dengan teks putih.
 * Pill non-aktif mengikuti EL-3a45804d: isi custom.disabled (#E9EAEC),
 * border 2px custom.borderDisabled (#D0D0D0), radius 16.
 * Angka tanggal memakai JetBrains Mono.
 */
export function DaySelector({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row items-center gap-2 py-1"
    >
      {DAYS.map((day) => (
        <DayPill
          key={day.id}
          day={day}
          isActive={day.id === selectedId}
          onPress={() => onSelect(day.id)}
        />
      ))}
    </ScrollView>
  )
}

type DayPillProps = {
  day: DayOption
  isActive: boolean
  onPress: () => void
}

function DayPill({ day, isActive, onPress }: DayPillProps) {
  return (
    <Touchable
      accessibilityLabel={day.longLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      scaleTo={0.92}
    >
      <View
        className={cn(
          "w-[52px] items-center justify-center gap-0.5 rounded-2xl border-2 py-2",
          isActive
            ? "border-custom-primary bg-custom-primary"
            : "border-custom-borderDisabled bg-custom-disabled"
        )}
      >
        <Text
          className={cn(
            "font-quicksand-semibold text-[11px] uppercase",
            isActive ? "text-white" : "text-slate-500"
          )}
        >
          {day.short}
        </Text>
        <Text
          className={cn(
            "font-mono-bold text-base",
            isActive ? "text-white" : "text-[#1C1C1E]"
          )}
        >
          {day.date}
        </Text>
      </View>
    </Touchable>
  )
}
