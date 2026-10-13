import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { CalendarDays as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react-native";

import { cn } from "@/lib/utils";
import { Touchable } from "@/components/ui/touchable";
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
 * Pemilih Hari Intuitif (7 Hari Terakhir Dinamis + Tombol Kalender).
 * Menggunakan prinsip Swiss Design: grid fungsional, kontras tinggi, tipografi tegas.
 */
export function DaySelector({ selectedId, onSelect }: DaySelectorProps) {
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const recentDays = getRecent7Days();

  // State kalender modal (bulan & tahun yang sedang ditampilkan)
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

  // Generate hari-hari dalam bulan aktif kalender
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
        {/* Tombol Kalender Swiss Design */}
        <Touchable
          accessibilityLabel="Open date range calendar"
          accessibilityRole="button"
          onPress={() => setCalendarModalVisible(true)}
          scaleTo={0.94}
        >
          <View
            className={cn(
              "h-[58px] w-[58px] items-center justify-center rounded-2xl border-2 shadow-sm",
              isCustomDateSelected
                ? "border-custom-black bg-sustom-disabled"
                : "border-custom-borderDisabled bg-white"
            )}
          >
            <CalendarIcon
              size={24}
              color={isCustomDateSelected ? "#FFFFFF" : "#0F172A"}
            />
          </View>
        </Touchable>

        {/* Scroll Horizontal 7 Hari Sebelum Hari Ini */}
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

      {/* MODAL KALENDER RENTANG TANGGAL (SWISS DESIGN) */}
      <Modal
        animationType="slide"
        transparent
        visible={calendarModalVisible}
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-[32px] border-t-2 border-slate-900 bg-white p-6 shadow-2xl">
            {/* Header Modal Swiss */}
            <View className="flex-row items-center justify-between border-b-2 border-slate-900 pb-2">
              <Text className="font-chivo-bold text-xl tracking-tight text-slate-900">
                Select History Date
              </Text>
              <Touchable onPress={() => setCalendarModalVisible(false)}>
                <View className="rounded-full border border-slate-200 bg-slate-100 p-2">
                  <X size={18} color="#0F172A" />
                </View>
              </Touchable>
            </View>

            {/* Navigasi Bulan */}
            <View className="my-4 flex-row items-center justify-between">
              <Touchable onPress={handlePrevMonth}>
                <View className="rounded-lg border border-slate-300 p-2">
                  <ChevronLeft size={16} color="#0F172A" />
                </View>
              </Touchable>
              <Text className="font-chivo-bold text-base uppercase text-slate-900">
                {monthYearLabel}
              </Text>
              <Touchable onPress={handleNextMonth}>
                <View className="rounded-lg border border-slate-300 p-2">
                  <ChevronRight size={16} color="#0F172A" />
                </View>
              </Touchable>
            </View>

            {/* Nama Hari Grid */}
            <View className="flex-row justify-between border-b border-slate-200 pb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((h) => (
                <Text
                  key={h}
                  className="w-10 text-center font-mono text-[10px] font-bold text-slate-400"
                >
                  {h}
                </Text>
              ))}
            </View>

            {/* Grid Tanggal */}
            <View className="mt-2 flex-row flex-wrap">
              {/* Offset hari awal */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <View key={`empty-${i}`} className="h-10 w-[14.28%]" />
              ))}

              {/* Tanggal dalam bulan */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateObj = new Date(
                  currentViewDate.getFullYear(),
                  currentViewDate.getMonth(),
                  dayNum
                );
                const isoString = formatToIsoDate(dateObj);
                const isSelected = selectedId === isoString;
                const isToday =
                  formatToIsoDate(new Date()) === isoString;

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
                        className={cn(
                          "h-full w-full items-center justify-center rounded-lg border",
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : isToday
                            ? "border-sky-500 bg-sky-50"
                            : "border-transparent bg-transparent"
                        )}
                      >
                        <Text
                          className={cn(
                            "font-mono text-xs font-bold",
                            isSelected
                              ? "text-white"
                              : isToday
                              ? "text-sky-600"
                              : "text-slate-800"
                          )}
                        >
                          {dayNum}
                        </Text>
                      </View>
                    </Touchable>
                  </View>
                );
              })}
            </View>

            {/* Preset Cepat (Swiss Style Bar) */}
            <View className="mt-6 flex-row gap-2 border-t border-slate-200 pt-4">
              <Touchable
                className="flex-1"
                onPress={() => {
                  onSelect(formatToIsoDate(new Date()));
                  setCalendarModalVisible(false);
                }}
              >
                <View className="items-center justify-center rounded-xl border border-slate-900 bg-white py-2.5">
                  <Text className="font-mono-bold text-xs uppercase text-slate-900">
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
                <View className="items-center justify-center rounded-xl border border-slate-200 bg-slate-100 py-2.5">
                  <Text className="font-mono-bold text-xs uppercase text-custom-black">
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
}

type DayPillProps = {
  day: DayOption;
  isActive: boolean;
  onPress: () => void;
};

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
          "w-[56px] items-center justify-center gap-0.5 rounded-2xl border-2 py-2 shadow-sm",
          isActive
            ? "border-custom-black bg-custom-black"
            : "border-custom-borderDisabled bg-white"
        )}
      >
        <Text
          className={cn(
            "font-mono text-[10px] font-bold uppercase",
            isActive ? "text-slate-300" : "text-slate-500"
          )}
        >
          {day.short}
        </Text>
        <Text
          className={cn(
            "font-mono-bold text-base",
            isActive ? "text-white" : "text-slate-900"
          )}
        >
          {day.date}
        </Text>
      </View>
    </Touchable>
  );
}
