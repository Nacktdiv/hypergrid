import React from "react";
import { Text, View } from "react-native";
import {
  Activity,
  AlertOctagon,
  Clock,
  Pause,
  Play,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react-native";

import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { MetricPill } from "@/components/ui/metric-pill";
import { Touchable } from "@/components/ui/touchable";
import { TOKENS } from "@/lib/theme/tokens";

export interface BottomHudProps {
  vehicleName?: string;
  plate?: string;
  speed?: number | string;
  vibration?: number | string;
  shockLevel?: number;
  gForce?: number;
  anomalyCount?: number;
  elapsedSeconds?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
  onStop?: () => void;
  sensorEnabled?: boolean;
  onToggleSensor?: () => void;
  onSimulateAnomaly?: () => void;
}

export function BottomHud({
  vehicleName = "Vehicle",
  plate,
  speed = 0,
  vibration = 0,
  shockLevel = 15,
  gForce = 1.0,
  anomalyCount = 0,
  elapsedSeconds = 0,
  isPaused = false,
  onTogglePause,
  onStop,
  sensorEnabled = true,
  onToggleSensor,
  onSimulateAnomaly,
}: BottomHudProps) {
  // Format MM:SS for ride timer
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;

  return (
    <AppCard
      variant="sheet"
      className="pb-6 pt-3 px-4 gap-3 bg-white shadow-2xl"
    >
      {/* Handle bar */}
      <View className="w-10 h-1 bg-slate-300 rounded-full self-center mb-1" />

      {/* 1. TRIP SUMMARY & LIVE SPEED HEADER */}
      <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
        <View className="flex-1 mr-2">
          <Text className="font-quicksand-bold text-base text-slate-900" numberOfLines={1}>
            {vehicleName}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <View className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <Text className="font-quicksand text-xs text-slate-500">
              {plate ? `Plate ${plate}` : "Live Telemetry Active"}
            </Text>
          </View>
        </View>

        {/* Live Speed Badge */}
        <View className="flex-row items-baseline gap-1 px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-100">
          <Text className="font-chivo-bold text-2xl text-brand">
            {speed}
          </Text>
          <Text className="font-quicksand-bold text-xs text-sky-700">
            km/h
          </Text>
        </View>
      </View>

      {/* 2. THREE METRIC PILLS (MATCHING REFERENCE UI SCREEN 3) */}
      <View className="flex-row items-center justify-between gap-2">
        <MetricPill
          icon={<Clock size={16} color={TOKENS.colors.brand.DEFAULT} />}
          label="Ride Time"
          value={timeFormatted}
          variant="light"
        />
        <MetricPill
          icon={<Zap size={16} color={TOKENS.colors.status.warning} />}
          label="Peak Shock"
          value={`${Number(gForce).toFixed(2)}G`}
          variant="light"
        />
        <MetricPill
          icon={<ShieldAlert size={16} color={TOKENS.colors.status.danger} />}
          label="Anomalies"
          value={`${anomalyCount} Pts`}
          variant="light"
        />
      </View>

      {/* 3. SENSOR & SIMULATION QUICK CONTROL BAR */}
      <View className="flex-row items-center justify-between gap-2">
        <Touchable
          onPress={onToggleSensor}
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Toggle phone motion sensor"
        >
          <View
            className={`flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-pill border ${
              sensorEnabled
                ? "bg-emerald-50 border-emerald-200"
                : "bg-slate-100 border-slate-200"
            }`}
          >
            <Activity
              size={13}
              color={sensorEnabled ? TOKENS.colors.status.success : "#94A3B8"}
            />
            <Text
              className={`font-quicksand-bold text-xs ${
                sensorEnabled ? "text-emerald-700" : "text-slate-500"
              }`}
            >
              {sensorEnabled ? "IMU 20Hz Active" : "Sensor Paused"}
            </Text>
          </View>
        </Touchable>

        <Touchable
          onPress={onSimulateAnomaly}
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Simulate pothole detection"
        >
          <View className="flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-pill bg-sky-50 border border-sky-200">
            <Sparkles size={13} color={TOKENS.colors.brand.DEFAULT} />
            <Text className="font-quicksand-bold text-xs text-brand">
              Simulate Shock
            </Text>
          </View>
        </Touchable>
      </View>

      {/* 4. DUAL ACTIONS: CIRCULAR PAUSE BUTTON + WIDE END RIDE PILL BUTTON */}
      <View className="flex-row items-center gap-3 mt-1">
        {/* Pause / Resume Circle Button */}
        <AppButton
          variant="circle"
          onPress={onTogglePause}
          iconLeft={
            isPaused ? (
              <Play size={22} color={TOKENS.colors.slate[800]} />
            ) : (
              <Pause size={22} color={TOKENS.colors.slate[800]} />
            )
          }
          accessibilityLabel={isPaused ? "Resume ride" : "Pause ride"}
        />

        {/* End Ride Button (Matching Reference Screen 3 in HyperGrid Brand Blue) */}
        <View className="flex-1">
          <AppButton
            variant="primary"
            size="lg"
            label="End Ride"
            onPress={onStop}
            iconLeft={
              <AlertOctagon size={20} color="#FFFFFF" strokeWidth={2.5} />
            }
            accessibilityLabel="End ride and save telemetry logs"
          />
        </View>
      </View>
    </AppCard>
  );
}
