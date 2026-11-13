import React, { useCallback, useSyncExternalStore } from "react";
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
import { useOptionalTheme } from "@/contexts/theme-context";

export interface ShockAlert {
  id?: string;
  title: string;
  subtitle: string;
  gForce?: number;
  severity?: "warning" | "danger" | "info";
}

export interface RideTelemetryStore {
  getElapsedSeconds: () => number;
  getLiveGForce: () => number;
  getMaxGForce: () => number;
  emitGForce: (gForce: number) => void;
  tickElapsed: () => void;
  subscribeElapsed: (listener: () => void) => () => void;
  subscribeGForce: (listener: () => void) => () => void;
}

export function createRideTelemetryStore(): RideTelemetryStore {
  let elapsedSeconds = 0;
  let liveGForce = 0;
  let maxGForce = 0;
  const elapsedListeners = new Set<() => void>();
  const gForceListeners = new Set<() => void>();

  return {
    getElapsedSeconds: () => elapsedSeconds,
    getLiveGForce: () => liveGForce,
    getMaxGForce: () => maxGForce,
    emitGForce: (nextGForce: number) => {
      if (nextGForce > maxGForce) {
        maxGForce = nextGForce;
      }
      if (nextGForce === liveGForce) return;
      liveGForce = nextGForce;
      gForceListeners.forEach((listener) => listener());
    },
    tickElapsed: () => {
      elapsedSeconds += 1;
      elapsedListeners.forEach((listener) => listener());
    },
    subscribeElapsed: (listener) => {
      elapsedListeners.add(listener);
      return () => {
        elapsedListeners.delete(listener);
      };
    },
    subscribeGForce: (listener) => {
      gForceListeners.add(listener);
      return () => {
        gForceListeners.delete(listener);
      };
    },
  };
}

const noopSubscribe = () => () => {};

const LiveElapsedMetricPill = React.memo(function LiveElapsedMetricPill({
  telemetry,
  fallbackElapsedSeconds,
  variant,
  iconColor,
}: {
  telemetry?: RideTelemetryStore;
  fallbackElapsedSeconds: number;
  variant: "light" | "dark";
  iconColor: string;
}) {
  const getFallback = useCallback(
    () => fallbackElapsedSeconds,
    [fallbackElapsedSeconds]
  );
  const elapsedSeconds = useSyncExternalStore(
    telemetry ? telemetry.subscribeElapsed : noopSubscribe,
    telemetry ? telemetry.getElapsedSeconds : getFallback
  );

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;

  return (
    <MetricPill
      icon={<Clock size={16} color={iconColor} />}
      label="Ride Time"
      value={timeFormatted}
      variant={variant}
    />
  );
});

const LiveShockMetricPill = React.memo(function LiveShockMetricPill({
  telemetry,
  fallbackGForce,
  variant,
  iconColor,
}: {
  telemetry?: RideTelemetryStore;
  fallbackGForce: number;
  variant: "light" | "dark";
  iconColor: string;
}) {
  const getFallback = useCallback(() => fallbackGForce, [fallbackGForce]);
  const liveGForce = useSyncExternalStore(
    telemetry ? telemetry.subscribeGForce : noopSubscribe,
    telemetry ? telemetry.getLiveGForce : getFallback
  );

  return (
    <MetricPill
      icon={<Zap size={16} color={iconColor} />}
      label="Peak Shock"
      value={`${Number(liveGForce).toFixed(2)}G`}
      variant={variant}
    />
  );
});

export interface BottomHudProps {
  vehicleName?: string;
  plate?: string;
  speed?: number | string;
  vibration?: number | string;
  shockLevel?: number;
  gForce?: number;
  peakGForce?: number;
  anomalyCount?: number;
  elapsedSeconds?: number;
  telemetry?: RideTelemetryStore;
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
  gForce = 1.0,
  anomalyCount = 0,
  elapsedSeconds = 0,
  telemetry,
  isPaused = false,
  onTogglePause,
  onStop,
  shockAlert,
  onDismissShockAlert,
}: BottomHudProps) {
  const { colors, isDark } = useOptionalTheme();

  const isDangerAlert = shockAlert?.severity === "danger";
  const pillVariant = isDark ? "dark" : "light";

  return (
    <AppCard
      variant="sheet"
      className="pb-6 pt-3 px-4 gap-3 shadow-2xl"
      style={{
        backgroundColor: colors.sheet,
        borderTopColor: colors.border,
      }}
    >
      <View
        className="w-10 h-1 rounded-full self-center mb-0.5"
        style={{ backgroundColor: isDark ? colors.borderStrong : "#CBD5E1" }}
      />

      {/* 1. TRIP SUMMARY & LIVE SPEED HEADER */}
      <View
        className="flex-row items-center justify-between pb-2.5 border-b"
        style={{ borderBottomColor: colors.border }}
      >
        <View className="flex-1 mr-2">
          <Text
            className="font-inter-bold text-base"
            style={{ color: colors.text }}
            numberOfLines={1}
          >
            {vehicleName}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: isPaused ? colors.warning : colors.success,
              }}
            />
            <Text
              className="font-inter text-xs"
              style={{ color: colors.textMuted }}
            >
              {isPaused ? "Paused" : plate ? plate : "Active"}
            </Text>
          </View>
        </View>

        <View
          className="flex-row items-baseline gap-1 px-3.5 py-1.5 rounded-2xl border"
          style={{
            backgroundColor: colors.brandSoft,
            borderColor: colors.brandBorder,
          }}
        >
          <Text
            className="font-inter-extrabold text-2xl"
            style={{ color: colors.brand }}
          >
            {speed}
          </Text>
          <Text
            className="font-inter-bold text-xs"
            style={{ color: colors.brandText }}
          >
            km/h
          </Text>
        </View>
      </View>

      {/* 2. THREE METRIC PILLS */}
      <View className="flex-row items-center justify-between gap-2">
        <LiveElapsedMetricPill
          telemetry={telemetry}
          fallbackElapsedSeconds={elapsedSeconds}
          variant={pillVariant}
          iconColor={colors.brand}
        />
        <LiveShockMetricPill
          telemetry={telemetry}
          fallbackGForce={gForce}
          variant={pillVariant}
          iconColor={colors.warning}
        />
        <MetricPill
          icon={<ShieldAlert size={16} color={colors.danger} />}
          label="Anomalies"
          value={`${anomalyCount} Pts`}
          variant={pillVariant}
        />
      </View>

      {/* 3. SHOCK / ANOMALY NOTIFICATION CARD (DISMISSIBLE) */}
      {shockAlert ? (
        <View
          className="flex-row items-center justify-between p-3 rounded-2xl border"
          style={{
            backgroundColor: isDangerAlert
              ? colors.dangerSoft
              : colors.warningSoft,
            borderColor: isDangerAlert
              ? isDark
                ? "rgba(239,68,68,0.35)"
                : "#FECDD3"
              : isDark
                ? "rgba(245,158,11,0.35)"
                : "#FDE68A",
          }}
        >
          <View className="flex-row items-center gap-2.5 flex-1 pr-2">
            <View
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{
                backgroundColor: isDangerAlert
                  ? colors.danger
                  : colors.warning,
              }}
            >
              <Zap size={16} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text
                className="font-inter-bold text-xs"
                style={{
                  color: isDangerAlert ? colors.dangerText : colors.warningText,
                }}
                numberOfLines={1}
              >
                {shockAlert.title}
              </Text>
              <Text
                className="font-inter text-[11px]"
                style={{ color: colors.textSecondary }}
                numberOfLines={1}
              >
                {shockAlert.subtitle}
              </Text>
            </View>
          </View>

          <Touchable
            onPress={onDismissShockAlert}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="w-7 h-7 rounded-full items-center justify-center border"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
            accessibilityRole="button"
            accessibilityLabel="Close notification"
          >
            <X size={14} color={colors.textMuted} />
          </Touchable>
        </View>
      ) : null}

      {/* 4. DUAL ACTIONS */}
      <View className="flex-row items-center gap-3 mt-0.5">
        <AppButton
          variant="circle"
          onPress={onTogglePause}
          iconLeft={
            isPaused ? (
              <Play size={22} color={colors.text} />
            ) : (
              <Pause size={22} color={colors.text} />
            )
          }
          accessibilityLabel={isPaused ? "Resume ride" : "Pause ride"}
        />

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
