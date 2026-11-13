import React, { useMemo, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import {
  CalendarDays as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react-native";

import { Touchable } from "@/components/ui/touchable";
import { useOptionalTheme } from "@/contexts/theme-context";
import {
  getRecent7Days,
  formatToIsoDate,
  type DayOption,
} from "./date-utils";

export interface DaySelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

/**
 * Intuitive Day Selector (Last 7 days + Calendar modal picker).
 */
export const DaySelector = React.memo(function DaySelector({
  selectedId,
  onSelect,
}: DaySelectorProps) {
  const { colors, isDark } = useOptionalTheme();
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const recentDays = useMemo(() => getRecent7Days(), []);

  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  const handlePrevMonth = () => {
    setCurrentViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() - 1);
      return next;
    });
  };

  const handleNextMonth = () => {
    setCurrentViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + 1);
      return next;
    });
  };

  const daysInMonth = new Date(
    currentViewDate.getFullYear(),
    currentViewDate.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfWeek = new Date(
    currentViewDate.getFullYear(),
    currentViewDate.getMonth(),
    1
  ).getDay();

  const monthYearLabel = currentViewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const isCustomDateSelected = !recentDays.some((d) => d.id === selectedId);

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Touchable
          accessibilityLabel="Open date range calendar"
          accessibilityRole="button"
          onPress={() => setCalendarModalVisible(true)}
          scaleTo={0.94}
        >
          <View
            className="h-[58px] w-[58px] items-center justify-center rounded-2xl border shadow-sm"
            style={{
              backgroundColor: isCustomDateSelected ? colors.brand : colors.card,
              borderColor: isCustomDateSelected ? colors.brand : colors.border,
            }}
          >
            <CalendarIcon
              size={22}
              color={isCustomDateSelected ? "#FFFFFF" : colors.text}
            />
          </View>
        </Touchable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="flex-row items-center gap-2 py-1 pr-4"
        >
          {recentDays.map((day) => (
            <DayPill
              key={day.id}
              day={day}
              isActive={day.id === selectedId}
              onPress={() => onSelect(day.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Date Range Calendar Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={calendarModalVisible}
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.overlay }}
        >
          <View
            className="rounded-t-[32px] border-t p-6 shadow-2xl"
            style={{
              backgroundColor: colors.sheet,
              borderTopColor: colors.border,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text
                className="font-inter-bold text-base"
                style={{ color: colors.text }}
              >
                Select Date
              </Text>
              <Touchable
                accessibilityLabel="Close calendar"
                accessibilityRole="button"
                onPress={() => setCalendarModalVisible(false)}
              >
                <View
                  className="rounded-full border p-2"
                  style={{
                    backgroundColor: colors.subtle,
                    borderColor: colors.border,
                  }}
                >
                  <X size={18} color={colors.text} />
                </View>
              </Touchable>
            </View>

            <View className="my-4 flex-row items-center justify-between">
              <Touchable
                accessibilityLabel="Previous month"
                accessibilityRole="button"
                onPress={handlePrevMonth}
              >
                <View
                  className="rounded-xl border p-2"
                  style={{
                    backgroundColor: colors.subtle,
                    borderColor: colors.border,
                  }}
                >
                  <ChevronLeft size={16} color={colors.text} />
                </View>
              </Touchable>
              <Text
                className="font-inter-extrabold text-sm uppercase tracking-wider"
                style={{ color: colors.text }}
              >
                {monthYearLabel}
              </Text>
              <Touchable
                accessibilityLabel="Next month"
                accessibilityRole="button"
                onPress={handleNextMonth}
              >
                <View
                  className="rounded-xl border p-2"
                  style={{
                    backgroundColor: colors.subtle,
                    borderColor: colors.border,
                  }}
                >
                  <ChevronRight size={16} color={colors.text} />
                </View>
              </Touchable>
            </View>

            <View
              className="flex-row justify-between border-b pb-2"
              style={{ borderBottomColor: colors.border }}
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((h) => (
                <Text
                  key={h}
                  className="w-10 text-center font-mono text-[10px] font-bold"
                  style={{ color: colors.textMuted }}
                >
                  {h}
                </Text>
              ))}
            </View>

            <View className="mt-2 flex-row flex-wrap">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <View key={`empty-${i}`} className="h-10 w-[14.28%]" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateObj = new Date(
                  currentViewDate.getFullYear(),
                  currentViewDate.getMonth(),
                  dayNum
                );
                const isoString = formatToIsoDate(dateObj);
                const isSelected = selectedId === isoString;
                const isToday = formatToIsoDate(new Date()) === isoString;

                return (
                  <View
                    key={isoString}
                    className="h-10 w-[14.28%] items-center justify-center p-0.5"
                  >
                    <Touchable
                      className="h-full w-full"
                      onPress={() => {
                        onSelect(isoString);
                        setCalendarModalVisible(false);
                      }}
                    >
                      <View
                        className="h-full w-full items-center justify-center rounded-xl border"
                        style={{
                          backgroundColor: isSelected
                            ? colors.brand
                            : isToday
                              ? colors.brandSoft
                              : "transparent",
                          borderColor: isSelected
                            ? colors.brand
                            : isToday
                              ? colors.brandBorder
                              : "transparent",
                        }}
                      >
                        <Text
                          className="font-mono text-xs font-bold"
                          style={{
                            color: isSelected
                              ? "#FFFFFF"
                              : isToday
                                ? colors.brandText
                                : colors.text,
                          }}
                        >
                          {dayNum}
                        </Text>
                      </View>
                    </Touchable>
                  </View>
                );
              })}
            </View>

            <View
              className="mt-6 flex-row gap-2.5 border-t pt-4"
              style={{ borderTopColor: colors.border }}
            >
              <Touchable
                className="flex-1"
                onPress={() => {
                  onSelect(formatToIsoDate(new Date()));
                  setCalendarModalVisible(false);
                }}
              >
                <View
                  className="items-center justify-center rounded-xl border py-2.5"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    className="font-inter-semibold text-xs"
                    style={{ color: colors.text }}
                  >
                    Today
                  </Text>
                </View>
              </Touchable>

              <Touchable
                className="flex-1"
                onPress={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  onSelect(formatToIsoDate(yesterday));
                  setCalendarModalVisible(false);
                }}
              >
                <View
                  className="items-center justify-center rounded-xl border py-2.5"
                  style={{
                    backgroundColor: isDark ? colors.cardMuted : colors.subtle,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    className="font-inter-semibold text-xs"
                    style={{ color: colors.text }}
                  >
                    Yesterday
                  </Text>
                </View>
              </Touchable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

type DayPillProps = {
  day: DayOption;
  isActive: boolean;
  onPress: () => void;
};

const DayPill = React.memo(function DayPill({
  day,
  isActive,
  onPress,
}: DayPillProps) {
  const { colors } = useOptionalTheme();

  return (
    <Touchable
      accessibilityLabel={day.longLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      scaleTo={0.92}
    >
      <View
        className="w-[56px] items-center justify-center gap-0.5 rounded-2xl border py-2 shadow-sm"
        style={{
          backgroundColor: isActive ? colors.brand : colors.card,
          borderColor: isActive ? colors.brand : colors.border,
        }}
      >
        <Text
          className="font-inter-bold text-[10px] uppercase"
          style={{ color: isActive ? "#FFFFFF" : colors.textMuted }}
        >
          {day.short}
        </Text>
        <Text
          className="font-mono-bold text-base"
          style={{ color: isActive ? "#FFFFFF" : colors.text }}
        >
          {day.date}
        </Text>
      </View>
    </Touchable>
  );
});
