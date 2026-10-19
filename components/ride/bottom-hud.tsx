import React from "react";
import { Text, View } from "react-native";
import {
  AlertOctagon,
  Clock,
  Pause,
  Play,
  ShieldAlert,
  X,
  Zap,
} from "lucide-react-native";

import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { MetricPill } from "@/components/ui/metric-pill";
import { Touchable } from "@/components/ui/touchable";
import { TOKENS } from "@/lib/theme/tokens";

export interface ShockAlert {
  id?: string;
  title: string;
  subtitle: string;
  gForce?: number;
  severity?: "warning" | "danger" | "info";
}

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
  shockAlert?: ShockAlert | null;
  onDismissShockAlert?: () => void;
  sensorEnabled?: boolean;
  onToggleSensor?: () => void;
  onSimulateAnomaly?: () => void;
}

export const BottomHud = React.memo(function BottomHud({
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
  shockAlert,
  onDismissShockAlert,
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

      {/* 2. THREE METRIC PILLS */}
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

      {/* 3. SHOCK / ANOMALY NOTIFICATION CARD (DISMISSIBLE) */}
      {shockAlert ? (
        <View
          className={`flex-row items-center justify-between p-3 rounded-2xl border ${
            shockAlert.severity === "danger"
              ? "bg-rose-50 border-rose-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <View className="flex-row items-center gap-2.5 flex-1 pr-2">
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                shockAlert.severity === "danger"
                  ? "bg-rose-500"
                  : "bg-amber-500"
              }`}
            >
              <Zap size={16} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text
                className={`font-quicksand-bold text-xs ${
                  shockAlert.severity === "danger"
                    ? "text-rose-950"
                    : "text-amber-950"
                }`}
                numberOfLines={1}
              >
                {shockAlert.title}
              </Text>
              <Text
                className={`font-quicksand text-[11px] ${
                  shockAlert.severity === "danger"
                    ? "text-rose-800"
                    : "text-amber-800"
                }`}
                numberOfLines={1}
              >
                {shockAlert.subtitle}
              </Text>
            </View>
          </View>

          <Touchable
            onPress={onDismissShockAlert}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="w-7 h-7 rounded-full items-center justify-center bg-white/90 border border-slate-200"
            accessibilityRole="button"
            accessibilityLabel="Close notification"
          >
            <X size={14} color={TOKENS.colors.slate[600]} />
          </Touchable>
        </View>
      ) : null}

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
});
