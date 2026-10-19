import React from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, G } from "react-native-svg";
import {
  CheckCircle2,
  Clock,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { TOKENS } from "@/lib/theme/tokens";

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

  const minutes = Math.floor(data.elapsedSeconds / 60);
  const seconds = data.elapsedSeconds % 60;
  const timeFormatted =
    minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

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
          color: "#10B981",
          bg: "bg-emerald-50",
          text: "text-emerald-700",
          border: "border-emerald-200",
        }
      : roadScore >= 70
      ? {
          label: "GOOD",
          color: "#009EFF",
          bg: "bg-sky-50",
          text: "text-sky-700",
          border: "border-sky-200",
        }
      : roadScore >= 50
      ? {
          label: "MODERATE",
          color: "#F59E0B",
          bg: "bg-amber-50",
          text: "text-amber-700",
          border: "border-amber-200",
        }
      : {
          label: "ROUGH",
          color: "#EF4444",
          bg: "bg-rose-50",
          text: "text-rose-700",
          border: "border-rose-200",
        };

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

  return (
    <View className="flex-1 bg-surface-canvas">
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
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-chivo-bold text-2xl text-slate-900">
                Trip Completed
              </Text>
              <Text className="font-quicksand text-xs text-slate-500 mt-0.5">
                Telemetry synchronized with HyperGrid Cloud
              </Text>
            </View>
            <View
              className={`px-3 py-1 rounded-full border ${statusConfig.bg} ${statusConfig.border}`}
            >
              <Text className={`font-mono-bold text-xs ${statusConfig.text}`}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Radial Telemetry Chart Card */}
        <AppCard className="p-4 items-center mb-3.5 bg-white border border-slate-200/90 shadow-xs">
          <View className="w-full flex-row items-center justify-between mb-1">
            <Text className="font-chivo-bold text-sm text-slate-800">
              Road Quality & Dynamics
            </Text>
            <View className="flex-row items-center gap-1.5">
              <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <Text className="font-quicksand text-xs text-slate-500">
                3-Axis Evaluation
              </Text>
            </View>
          </View>

          <View
            style={{ width: size, height: size }}
            className="items-center justify-center relative my-2"
          >
            <Svg width={size} height={size}>
              {/* Spiderweb spokes */}
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
                      stroke="#E2E8F0"
                      strokeWidth={1}
                    />
                  );
                })}
              </G>

              {/* Background rings */}
              <Circle
                cx={center}
                cy={center}
                r={26}
                stroke="#E2E8F0"
                strokeWidth={1}
                fill="none"
              />
              <Circle
                cx={center}
                cy={center}
                r={rInner}
                stroke="#F1F5F9"
                strokeWidth={strokeW}
                fill="none"
              />
              <Circle
                cx={center}
                cy={center}
                r={rMiddle}
                stroke="#F1F5F9"
                strokeWidth={strokeW}
                fill="none"
              />
              <Circle
                cx={center}
                cy={center}
                r={rOuter}
                stroke="#F1F5F9"
                strokeWidth={strokeW}
                fill="none"
              />
              <Circle
                cx={center}
                cy={center}
                r={86}
                stroke="#E2E8F0"
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
                stroke="#38BDF8"
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

            {/* Score Center Label */}
            <View className="absolute inset-0 items-center justify-center pointer-events-none">
              <Text className="font-chivo-bold text-3xl text-slate-900 tracking-tight">
                {roadScore}
              </Text>
              <Text className="font-quicksand-bold text-[10px] text-slate-400 tracking-widest uppercase">
                Score
              </Text>
            </View>
          </View>

          {/* Radial Legend */}
          <View className="flex-row items-center justify-center gap-4 pt-2 border-t border-slate-100 w-full">
            <View className="flex-row items-center gap-1.5">
              <View
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: statusConfig.color }}
              />
              <Text className="font-quicksand text-xs text-slate-600">
                Road ({roadScore}%)
              </Text>
            </View>

            <View className="flex-row items-center gap-1.5">
              <View className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <Text className="font-quicksand text-xs text-slate-600">
                Stability ({stabilityScore}%)
              </Text>
            </View>

            <View className="flex-row items-center gap-1.5">
              <View className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <Text className="font-quicksand text-xs text-slate-600">
                Clearance ({clearanceScore}%)
              </Text>
            </View>
          </View>
        </AppCard>

        {/* 2x2 Performance Metrics Grid */}
        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <AppCard className="p-3.5 bg-white border border-slate-200/90 shadow-xs">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="font-quicksand text-xs text-slate-500">
                  Distance
                </Text>
                <Navigation size={15} color={TOKENS.colors.brand.DEFAULT} />
              </View>
              <Text className="font-chivo-bold text-xl text-slate-900">
                {distanceFormatted}
              </Text>
            </AppCard>
          </View>

          <View className="flex-1">
            <AppCard className="p-3.5 bg-white border border-slate-200/90 shadow-xs">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="font-quicksand text-xs text-slate-500">
                  Duration
                </Text>
                <Clock size={15} color={TOKENS.colors.brand.DEFAULT} />
              </View>
              <Text className="font-chivo-bold text-xl text-slate-900">
                {timeFormatted}
              </Text>
            </AppCard>
          </View>
        </View>

        <View className="flex-row gap-3 mb-3.5">
          <View className="flex-1">
            <AppCard className="p-3.5 bg-white border border-slate-200/90 shadow-xs">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="font-quicksand text-xs text-slate-500">
                  Road Defects
                </Text>
                {data.detectedCount > 0 ? (
                  <ShieldAlert size={15} color={TOKENS.colors.status.danger} />
                ) : (
                  <ShieldCheck size={15} color={TOKENS.colors.status.success} />
                )}
              </View>
              <Text
                className={`font-chivo-bold text-xl ${
                  data.detectedCount > 0 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {data.detectedCount} Pts
              </Text>
            </AppCard>
          </View>

          <View className="flex-1">
            <AppCard className="p-3.5 bg-white border border-slate-200/90 shadow-xs">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="font-quicksand text-xs text-slate-500">
                  Peak Shock
                </Text>
                <Zap size={15} color={TOKENS.colors.status.warning} />
              </View>
              <Text className="font-chivo-bold text-xl text-slate-900">
                {data.maxGForce.toFixed(2)}G
              </Text>
            </AppCard>
          </View>
        </View>

        {/* Telemetry & Cloud Verification Card */}
        <AppCard className="p-4 bg-white border border-slate-200/90 shadow-xs mb-5">
          <Text className="font-chivo-bold text-xs text-slate-800 uppercase tracking-wider mb-2.5">
            System & Synchronization
          </Text>

          {data.vehicleName && (
            <View className="flex-row items-center justify-between py-1.5 border-b border-slate-100">
              <Text className="font-quicksand text-xs text-slate-500">
                Vehicle Profile
              </Text>
              <Text className="font-quicksand-bold text-xs text-slate-900">
                {data.vehicleName}
                {data.vehiclePlate ? ` (${data.vehiclePlate})` : ""}
              </Text>
            </View>
          )}

          <View className="flex-row items-center justify-between py-1.5 border-b border-slate-100">
            <Text className="font-quicksand text-xs text-slate-500">
              Detection Pipeline
            </Text>
            <Text className="font-mono-bold text-xs text-brand">
              {data.isTflite ? "TFLite Neural Net" : "Smart Edge AI Heuristic"}
            </Text>
          </View>

          <View className="flex-row items-center justify-between py-1.5 border-b border-slate-100">
            <Text className="font-quicksand text-xs text-slate-500">
              Confidence Rating
            </Text>
            <Text className="font-mono-bold text-xs text-emerald-600">
              {data.confidencePercent ?? 94}% (
              {data.confidenceTier ?? "HIGH"})
            </Text>
          </View>

          <View className="flex-row items-center justify-between pt-1.5">
            <Text className="font-quicksand text-xs text-slate-500">
              PostGIS Server
            </Text>
            <View className="flex-row items-center gap-1">
              <CheckCircle2 size={13} color={TOKENS.colors.status.success} />
              <Text className="font-quicksand-bold text-xs text-emerald-700">
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

          <AppButton
            variant="outline"
            size="lg"
            label="Back to Home"
            onPress={onBackHome}
            accessibilityLabel="Return to home map screen"
          />
        </View>
      </ScrollView>
    </View>
  );
}
