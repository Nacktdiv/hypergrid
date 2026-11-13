import {
  CheckCircle2,
  Clock,
  Navigation,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react-native";
import React, { useCallback } from "react";
import { ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G, Line } from "react-native-svg";

import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { useOptionalTheme } from "@/contexts/theme-context";

export interface TripCompletedData {
  elapsedSeconds: number;
  detectedCount: number;
  maxGForce: number;
  averageSpeed?: number;
  distanceMeters: number;
  vehicleName?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  isTflite?: boolean;
  confidencePercent?: number;
  confidenceTier?: string;
  destinationName?: string;
  startLocationName?: string;
}

export interface TripCompletedViewProps {
  data: TripCompletedData;
  onViewHistory: () => void;
  onBackHome: () => void;
}

export function TripCompletedView({
  data,
  onViewHistory,
  onBackHome,
}: TripCompletedViewProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useOptionalTheme();

  const minutes = Math.floor(data.elapsedSeconds / 60);
  const seconds = data.elapsedSeconds % 60;
  const timeFormatted = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  const distanceFormatted =
    data.distanceMeters >= 1000
      ? `${(data.distanceMeters / 1000).toFixed(2)} km`
      : `${Math.round(data.distanceMeters)} m`;

  const roadScore = Math.max(
    30,
    Math.min(
      100,
      Math.round(
        100 -
          data.detectedCount * 12 -
          Math.max(0, (data.maxGForce - 1.0) * 15)
      )
    )
  );

  const stabilityScore = Math.max(
    40,
    Math.min(100, Math.round(100 - Math.max(0, (data.maxGForce - 1.0) * 22)))
  );

  const clearanceScore = Math.max(
    25,
    Math.min(100, Math.round(100 - data.detectedCount * 16))
  );

  const statusConfig =
    roadScore >= 85
      ? {
          label: "SMOOTH",
          color: colors.success,
          bg: colors.successSoft,
          text: colors.successText,
          border: isDark ? "rgba(16,185,129,0.35)" : "#A7F3D0",
        }
      : roadScore >= 70
        ? {
            label: "GOOD",
            color: colors.brand,
            bg: colors.brandSoft,
            text: colors.brandText,
            border: colors.brandBorder,
          }
        : roadScore >= 50
          ? {
              label: "MODERATE",
              color: colors.warning,
              bg: colors.warningSoft,
              text: colors.warningText,
              border: isDark ? "rgba(245,158,11,0.35)" : "#FDE68A",
            }
          : {
              label: "ROUGH",
              color: colors.danger,
              bg: colors.dangerSoft,
              text: colors.dangerText,
              border: isDark ? "rgba(239,68,68,0.35)" : "#FECDD3",
            };

  const handleShareTrip = useCallback(async () => {
    const routeLine = data.destinationName
      ? `${data.startLocationName || "Origin"} -> ${data.destinationName}`
      : "Free Ride Telemetry Session";
    const summaryText =
      `HyperGrid Trip Completed\n` +
      `Route: ${routeLine}\n` +
      `Distance: ${distanceFormatted} | Duration: ${timeFormatted}\n` +
      `Road Score: ${roadScore}/100 (${statusConfig.label})\n` +
      `Defects: ${data.detectedCount} pts | Peak Shock: ${data.maxGForce.toFixed(2)}G`;
    try {
      await Share.share({
        title: "HyperGrid Trip Summary",
        message: summaryText,
      });
    } catch {
      // User dismissed share sheet
    }
  }, [
    data.destinationName,
    data.detectedCount,
    data.maxGForce,
    data.startLocationName,
    distanceFormatted,
    roadScore,
    statusConfig.label,
    timeFormatted,
  ]);

  const size = 190;
  const center = size / 2;
  const rOuter = 76;
  const rMiddle = 58;
  const rInner = 40;
  const strokeW = 9;

  const circOuter = 2 * Math.PI * rOuter;
  const circMiddle = 2 * Math.PI * rMiddle;
  const circInner = 2 * Math.PI * rInner;

  const spokeAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  const guideStroke = isDark ? colors.border : "#E2E8F0";
  const trackStroke = isDark ? "#1E2430" : "#F1F5F9";

  return (
    <View className="flex-1" style={{ backgroundColor: colors.canvas }}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: Math.max(insets.bottom, 20) + 24,
          paddingHorizontal: 16,
        }}
      >
        {/* Header */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1">
              <Text
                className="font-inter-extrabold text-2xl tracking-tight"
                style={{ color: colors.text }}
              >
                Trip Completed
              </Text>
              <Text
                className="font-inter text-xs mt-0.5"
                style={{ color: colors.textMuted }}
              >
                Telemetry synchronized with HyperGrid Cloud
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <AppButton
                variant="circle"
                size="sm"
                onPress={handleShareTrip}
                iconLeft={<Share2 size={17} color={colors.text} />}
                accessibilityLabel="Share trip summary"
              />
              <View
                className="px-3 py-1.5 rounded-full border"
                style={{
                  backgroundColor: statusConfig.bg,
                  borderColor: statusConfig.border,
                }}
              >
                <Text
                  className="font-mono-bold text-xs"
                  style={{ color: statusConfig.text }}
                >
                  {statusConfig.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Radial Telemetry Chart Card */}
        <AppCard
          className="p-4 items-center mb-3.5"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <View className="w-full flex-row items-center justify-between mb-1">
            <Text
              className="font-inter-bold text-sm"
              style={{ color: colors.text }}
            >
              Road Quality & Dynamics
            </Text>
            <View className="flex-row items-center gap-1.5">
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: colors.success }}
              />
              <Text
                className="font-inter text-xs"
                style={{ color: colors.textMuted }}
              >
                3-Axis Evaluation
              </Text>
            </View>
          </View>

          <View
            style={{ width: size, height: size }}
            className="items-center justify-center relative my-2"
          >
            <Svg width={size} height={size}>
              <G>
                {spokeAngles.map((angle) => {
                  const rad = (angle * Math.PI) / 180;
                  const x1 = center + 26 * Math.cos(rad);
                  const y1 = center + 26 * Math.sin(rad);
                  const x2 = center + 86 * Math.cos(rad);
                  const y2 = center + 86 * Math.sin(rad);
                  return (
                    <Line
                      key={angle}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={guideStroke}
                      strokeWidth={1}
                    />
                  );
                })}
              </G>

              <Circle
                cx={center}
                cy={center}
                r={26}
                stroke={guideStroke}
                strokeWidth={1}
                fill="none"
              />
              <Circle
                cx={center}
                cy={center}
                r={rInner}
                stroke={trackStroke}
                strokeWidth={strokeW}
                fill="none"
              />
              <Circle
                cx={center}
                cy={center}
                r={rMiddle}
                stroke={trackStroke}
                strokeWidth={strokeW}
                fill="none"
              />
              <Circle
                cx={center}
                cy={center}
                r={rOuter}
                stroke={trackStroke}
                strokeWidth={strokeW}
                fill="none"
              />
              <Circle
                cx={center}
                cy={center}
                r={86}
                stroke={guideStroke}
                strokeWidth={1}
                fill="none"
              />

              {/* Inner ring: Surface Clearance */}
              <Circle
                cx={center}
                cy={center}
                r={rInner}
                stroke="#8B5CF6"
                strokeWidth={strokeW}
                fill="none"
                strokeDasharray={`${circInner} ${circInner}`}
                strokeDashoffset={circInner * (1 - clearanceScore / 100)}
                strokeLinecap="round"
                transform={`rotate(-90 ${center} ${center})`}
              />

              {/* Middle ring: Ride Stability */}
              <Circle
                cx={center}
                cy={center}
                r={rMiddle}
                stroke={colors.brand}
                strokeWidth={strokeW}
                fill="none"
                strokeDasharray={`${circMiddle} ${circMiddle}`}
                strokeDashoffset={circMiddle * (1 - stabilityScore / 100)}
                strokeLinecap="round"
                transform={`rotate(-90 ${center} ${center})`}
              />

              {/* Outer ring: Road Health Score */}
              <Circle
                cx={center}
                cy={center}
                r={rOuter}
                stroke={statusConfig.color}
                strokeWidth={strokeW}
                fill="none"
                strokeDasharray={`${circOuter} ${circOuter}`}
                strokeDashoffset={circOuter * (1 - roadScore / 100)}
                strokeLinecap="round"
                transform={`rotate(-90 ${center} ${center})`}
              />
            </Svg>

            <View className="absolute inset-0 items-center justify-center pointer-events-none">
              <Text
                className="font-inter-extrabold text-3xl tracking-tight"
                style={{ color: colors.text }}
              >
                {roadScore}
              </Text>
              <Text
                className="font-inter-bold text-[10px] tracking-widest uppercase"
                style={{ color: colors.textMuted }}
              >
                Score
              </Text>
            </View>
          </View>

          <View
            className="flex-row items-center justify-center gap-4 pt-2.5 border-t w-full"
            style={{ borderTopColor: colors.border }}
          >
            <View className="flex-row items-center gap-1.5">
              <View
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: statusConfig.color }}
              />
              <Text
                className="font-inter-medium text-xs"
                style={{ color: colors.textSecondary }}
              >
                Road ({roadScore}%)
              </Text>
            </View>

            <View className="flex-row items-center gap-1.5">
              <View
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: colors.brand }}
              />
              <Text
                className="font-inter-medium text-xs"
                style={{ color: colors.textSecondary }}
              >
                Stability ({stabilityScore}%)
              </Text>
            </View>

            <View className="flex-row items-center gap-1.5">
              <View className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <Text
                className="font-inter-medium text-xs"
                style={{ color: colors.textSecondary }}
              >
                Clearance ({clearanceScore}%)
              </Text>
            </View>
          </View>
        </AppCard>

        {/* 2x2 Performance Metrics Grid */}
        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <AppCard
              className="p-3.5"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <Text
                  className="font-inter-medium text-xs"
                  style={{ color: colors.textMuted }}
                >
                  Distance
                </Text>
                <Navigation size={15} color={colors.brand} />
              </View>
              <Text
                className="font-inter-extrabold text-xl"
                style={{ color: colors.text }}
              >
                {distanceFormatted}
              </Text>
            </AppCard>
          </View>

          <View className="flex-1">
            <AppCard
              className="p-3.5"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <Text
                  className="font-inter-medium text-xs"
                  style={{ color: colors.textMuted }}
                >
                  Duration
                </Text>
                <Clock size={15} color={colors.brand} />
              </View>
              <Text
                className="font-inter-extrabold text-xl"
                style={{ color: colors.text }}
              >
                {timeFormatted}
              </Text>
            </AppCard>
          </View>
        </View>

        <View className="flex-row gap-3 mb-3.5">
          <View className="flex-1">
            <AppCard
              className="p-3.5"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <Text
                  className="font-inter-medium text-xs"
                  style={{ color: colors.textMuted }}
                >
                  Road Defects
                </Text>
                {data.detectedCount > 0 ? (
                  <ShieldAlert size={15} color={colors.danger} />
                ) : (
                  <ShieldCheck size={15} color={colors.success} />
                )}
              </View>
              <Text
                className="font-inter-extrabold text-xl"
                style={{
                  color:
                    data.detectedCount > 0
                      ? colors.dangerText
                      : colors.successText,
                }}
              >
                {data.detectedCount} Pts
              </Text>
            </AppCard>
          </View>

          <View className="flex-1">
            <AppCard
              className="p-3.5"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <Text
                  className="font-inter-medium text-xs"
                  style={{ color: colors.textMuted }}
                >
                  Peak Shock
                </Text>
                <Zap size={15} color={colors.warning} />
              </View>
              <Text
                className="font-inter-extrabold text-xl"
                style={{ color: colors.text }}
              >
                {data.maxGForce.toFixed(2)}G
              </Text>
            </AppCard>
          </View>
        </View>

        {/* Departure & Destination Timeline Card */}
        {data.destinationName ? (
          <AppCard
            className="p-4 mb-3.5"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <Navigation size={14} color={colors.brand} />
              <Text
                className="font-inter-bold text-xs uppercase tracking-wider"
                style={{ color: colors.text }}
              >
                Trip Route & Destination
              </Text>
            </View>

            <View className="flex-row items-stretch">
              <View className="items-center mr-3 pt-1 pb-1">
                <View
                  className="w-2.5 h-2.5 rounded-full border-2"
                  style={{ borderColor: colors.textMuted }}
                />
                <View
                  className="w-[1.5px] flex-1 my-1"
                  style={{ backgroundColor: colors.borderStrong }}
                />
                <View
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colors.brand }}
                />
              </View>

              <View className="flex-1 justify-between gap-2.5">
                <View>
                  <Text
                    className="font-inter text-[11px]"
                    style={{ color: colors.textMuted }}
                  >
                    Departure
                  </Text>
                  <Text
                    className="font-inter-semibold text-xs mt-0.5"
                    style={{ color: colors.text }}
                    numberOfLines={1}
                  >
                    {data.startLocationName || "Origin Location"}
                  </Text>
                </View>

                <View>
                  <Text
                    className="font-inter text-[11px]"
                    style={{ color: colors.textMuted }}
                  >
                    Final Destination
                  </Text>
                  <Text
                    className="font-inter-bold text-xs mt-0.5"
                    style={{ color: colors.brand }}
                    numberOfLines={1}
                  >
                    {data.destinationName}
                  </Text>
                </View>
              </View>
            </View>
          </AppCard>
        ) : null}

        {/* Telemetry & Cloud Verification Card */}
        <AppCard
          className="p-4 mb-5"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <Text
            className="font-inter-bold text-xs uppercase tracking-wider mb-2.5"
            style={{ color: colors.text }}
          >
            System & Synchronization
          </Text>

          {data.vehicleName ? (
            <View
              className="flex-row items-center justify-between py-2 border-b"
              style={{ borderBottomColor: colors.border }}
            >
              <Text
                className="font-inter text-xs"
                style={{ color: colors.textMuted }}
              >
                Vehicle Profile
              </Text>
              <Text
                className="font-inter-bold text-xs"
                style={{ color: colors.text }}
              >
                {data.vehicleName}
                {data.vehiclePlate ? ` (${data.vehiclePlate})` : ""}
              </Text>
            </View>
          ) : null}

          <View
            className="flex-row items-center justify-between py-2 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <Text
              className="font-inter text-xs"
              style={{ color: colors.textMuted }}
            >
              Detection Pipeline
            </Text>
            <Text
              className="font-mono-bold text-xs"
              style={{ color: colors.brand }}
            >
              {data.detectedCount === 0
                ? "Zero Prediction (No Anomaly)"
                : data.isTflite
                  ? "TFLite Neural Net"
                  : "Smart Edge AI Heuristic"}
            </Text>
          </View>

          <View
            className="flex-row items-center justify-between py-2 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <Text
              className="font-inter text-xs"
              style={{ color: colors.textMuted }}
            >
              Confidence Rating
            </Text>
            <Text
              className="font-mono-bold text-xs"
              style={{
                color:
                  data.detectedCount > 0
                    ? colors.successText
                    : colors.textMuted,
              }}
            >
              {data.detectedCount > 0
                ? `${data.confidencePercent ?? 0}% (${data.confidenceTier ?? "HIGH"})`
                : "0% (NONE)"}
            </Text>
          </View>

          <View className="flex-row items-center justify-between pt-2">
            <Text
              className="font-inter text-xs"
              style={{ color: colors.textMuted }}
            >
              PostGIS Server
            </Text>
            <View className="flex-row items-center gap-1">
              <CheckCircle2 size={13} color={colors.success} />
              <Text
                className="font-inter-bold text-xs"
                style={{ color: colors.successText }}
              >
                Synchronized
              </Text>
            </View>
          </View>
        </AppCard>

        {/* Action CTAs */}
        <View className="gap-2.5">
          <AppButton
            variant="primary"
            size="lg"
            label="View Trip History"
            onPress={onViewHistory}
            accessibilityLabel="Open trip history screen"
          />

          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <AppButton
                variant="outline"
                size="lg"
                label="Share Trip"
                onPress={handleShareTrip}
                iconLeft={<Share2 size={16} color={colors.text} />}
                accessibilityLabel="Share trip summary"
              />
            </View>
            <View className="flex-1">
              <AppButton
                variant="outline"
                size="lg"
                label="Done"
                onPress={onBackHome}
                accessibilityLabel="Return to home map screen"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
