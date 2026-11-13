import React, { useState } from "react";
import { Text, View } from "react-native";
import { ChevronDown, TriangleAlert } from "lucide-react-native";

import { Touchable } from "@/components/ui/touchable";
import { useOptionalTheme } from "@/contexts/theme-context";

import type { HistoryEntry } from "./mock-data";

/**
 * Timeline trip & anomaly entry card matching the Light/Dark design system.
 */
export const HistoryItemCard = React.memo(function HistoryItemCard({
  entry,
}: {
  entry: HistoryEntry;
}) {
  const { colors, isDark } = useOptionalTheme();
  const [open, setOpen] = useState(false);
  const hasGuncangan = entry.guncangan > 0;

  return (
    <View
      className="rounded-3xl border p-5"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <Touchable
        accessibilityHint="Expand or collapse trip notes"
        accessibilityLabel={`${entry.from} to ${entry.to}`}
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
      >
        <View className="flex-row items-start justify-between gap-4">
          {/* Vertical Origin -> Destination Timeline Connector */}
          <View className="flex-1 flex-row items-stretch">
            <View className="items-center mr-3 pt-1.5 pb-1.5">
              <View
                className="h-2.5 w-2.5 rounded-full border-2"
                style={{ borderColor: colors.textMuted }}
              />
              <View
                className="w-[1.5px] flex-1 my-1"
                style={{ backgroundColor: colors.borderStrong }}
              />
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colors.brand }}
              />
            </View>

            <View className="flex-1 justify-between gap-2.5">
              <View className="flex-row items-baseline gap-2">
                <Text
                  className="text-[10px] font-mono-bold uppercase w-9"
                  style={{ color: colors.textMuted }}
                >
                  From
                </Text>
                <Text
                  className="flex-1 font-inter-semibold text-sm"
                  style={{ color: colors.text }}
                  numberOfLines={1}
                >
                  {entry.from}
                </Text>
              </View>

              <View className="flex-row items-baseline gap-2">
                <Text
                  className="text-[10px] font-mono-bold uppercase w-9"
                  style={{ color: colors.textMuted }}
                >
                  To
                </Text>
                <Text
                  className="flex-1 font-inter-bold text-sm"
                  style={{ color: colors.text }}
                  numberOfLines={1}
                >
                  {entry.to}
                </Text>
              </View>
            </View>
          </View>

          <View className="items-end gap-1">
            <Text
              className="font-mono text-[11px] font-semibold"
              style={{ color: colors.textMuted }}
            >
              {entry.date}
            </Text>
            <Text
              className="font-mono-bold text-xs"
              style={{ color: colors.brand }}
            >
              {entry.distance}
            </Text>
          </View>
        </View>
      </Touchable>

      <View
        className="mt-4 flex-row items-center justify-between border-t pt-3.5"
        style={{ borderTopColor: colors.border }}
      >
        <Text
          className="font-inter-medium text-xs"
          style={{ color: colors.textMuted }}
        >
          {entry.time}
        </Text>

        <View className="flex-row items-center gap-2">
          <View
            className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1 border"
            style={{
              backgroundColor: hasGuncangan
                ? colors.dangerSoft
                : isDark
                  ? colors.cardMuted
                  : colors.subtle,
              borderColor: hasGuncangan
                ? isDark
                  ? "rgba(239,68,68,0.35)"
                  : "#FECDD3"
                : colors.border,
            }}
          >
            <TriangleAlert
              size={12}
              color={hasGuncangan ? colors.danger : colors.textMuted}
            />
            <Text
              className="font-mono text-[11px]"
              style={{
                color: hasGuncangan ? colors.dangerText : colors.textSecondary,
                fontWeight: hasGuncangan ? "700" : "600",
              }}
            >
              {entry.guncangan} {entry.guncangan === 1 ? "shock" : "shocks"}
            </Text>
          </View>

          <ChevronDown
            size={16}
            color={colors.textMuted}
            style={{
              transform: [{ rotate: open ? "180deg" : "0deg" }],
            }}
          />
        </View>
      </View>

      {open ? (
        <View
          className="mt-3 rounded-2xl border p-3"
          style={{
            backgroundColor: colors.cardMuted,
            borderColor: colors.border,
          }}
        >
          <Text
            className="font-inter text-xs leading-5"
            style={{ color: colors.textSecondary }}
          >
            {entry.note}
          </Text>
        </View>
      ) : null}
    </View>
  );
});
