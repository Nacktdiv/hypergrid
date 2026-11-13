import { Zap } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";

import { AppCard } from "@/components/ui/app-card";
import { useOptionalTheme } from "@/contexts/theme-context";
import type { Metric } from "./mock-data";

/**
 * Radial Chart - Telemetry Breakdown
 */
export const MetricsSummary = React.memo(function MetricsSummary({
  metrics,
}: {
  metrics: Metric[];
}) {
  const { colors, isDark } = useOptionalTheme();

  const anomalyMetric = metrics.find((m) => m.id === "rusak");
  const confidenceMetric = metrics.find((m) => m.id === "confidence");
  const peakMetric = metrics.find((m) => m.id === "peak");

  const anomalyCount = anomalyMetric
    ? parseFloat(anomalyMetric.value.replace(/[^0-9.]/g, "")) || 0
    : 0;
  const confidencePct = confidenceMetric
    ? parseFloat(confidenceMetric.value.replace(/[^0-9.]/g, "")) || 0
    : 0;
  const peakVal = peakMetric
    ? parseFloat(peakMetric.value.replace(/[^0-9.]/g, "")) || 0
    : 0;

  const outerRatio = Math.min(
    1,
    Math.max(peakVal > 0 ? 0.08 : 0.03, peakVal / 3.0)
  );
  const middleRatio = Math.min(
    1,
    Math.max(confidencePct > 0 ? 0.08 : 0.03, confidencePct / 100)
  );
  const innerRatio = Math.min(
    1,
    Math.max(anomalyCount > 0 ? 0.08 : 0.03, anomalyCount / 10)
  );

  const size = 200;
  const center = size / 2;

  const rOuter = 82;
  const rMiddle = 65;
  const rInner = 48;
  const strokeW = 10;

  const circOuter = 2 * Math.PI * rOuter;
  const circMiddle = 2 * Math.PI * rMiddle;
  const circInner = 2 * Math.PI * rInner;

  const spokeAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  const guideStroke = isDark ? colors.border : "#E2E8F0";
  const trackStroke = isDark ? "#1E2430" : "#F1F5F9";
  const peakColor = isDark ? "#3B82F6" : "#1D4ED8";

  return (
    <AppCard
      variant="default"
      className="p-5 gap-4"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text
            className="font-inter-extrabold text-sm"
            style={{ color: colors.text }}
          >
            Trip Summary
          </Text>
        </View>
      </View>

      <View className="items-center justify-center py-3">
        <View
          style={{ width: size, height: size }}
          className="items-center justify-center relative"
        >
          <Svg width={size} height={size}>
            <G>
              {spokeAngles.map((angle) => {
                const rad = (angle * Math.PI) / 180;
                const x1 = center + 34 * Math.cos(rad);
                const y1 = center + 34 * Math.sin(rad);
                const x2 = center + 95 * Math.cos(rad);
                const y2 = center + 95 * Math.sin(rad);
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
              r={35}
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
              r={95}
              stroke={guideStroke}
              strokeWidth={1}
              fill="none"
            />

            <Circle
              cx={center}
              cy={center}
              r={rInner}
              stroke="#38BDF8"
              strokeWidth={strokeW}
              fill="none"
              strokeDasharray={`${circInner} ${circInner}`}
              strokeDashoffset={circInner * (1 - innerRatio)}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />

            <Circle
              cx={center}
              cy={center}
              r={rMiddle}
              stroke={colors.brand}
              strokeWidth={strokeW}
              fill="none"
              strokeDasharray={`${circMiddle} ${circMiddle}`}
              strokeDashoffset={circMiddle * (1 - middleRatio)}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />

            <Circle
              cx={center}
              cy={center}
              r={rOuter}
              stroke={peakColor}
              strokeWidth={strokeW}
              fill="none"
              strokeDasharray={`${circOuter} ${circOuter}`}
              strokeDashoffset={circOuter * (1 - outerRatio)}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>

          <View className="absolute items-center justify-center">
            <Zap size={20} color={colors.brand} />
            <Text
              className="font-mono-bold text-xs mt-0.5"
              style={{ color: colors.text }}
            >
              {peakVal > 0 ? `${peakVal}G` : "0.0G"}
            </Text>
          </View>
        </View>
      </View>

      <View
        className="flex-row rounded-2xl border p-3"
        style={{
          backgroundColor: colors.cardMuted,
          borderColor: colors.border,
        }}
      >
        <View
          className="flex-1 items-center px-1 border-r"
          style={{ borderRightColor: colors.border }}
        >
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <View className="h-2 w-2 rounded-full bg-[#38BDF8]" />
            <Text
              className="font-inter-medium text-[11px]"
              style={{ color: colors.textMuted }}
              numberOfLines={1}
            >
              Anomalies
            </Text>
          </View>
          <Text
            className="font-mono-bold text-sm"
            style={{ color: colors.text }}
          >
            {anomalyCount}
          </Text>
          <Text
            className="font-inter text-[10px] mt-1"
            style={{ color: colors.textMuted }}
          >
            Locations
          </Text>
        </View>

        <View
          className="flex-1 items-center px-1 border-r"
          style={{ borderRightColor: colors.border }}
        >
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colors.brand }}
            />
            <Text
              className="font-inter-medium text-[11px]"
              style={{ color: colors.textMuted }}
              numberOfLines={1}
            >
              Confidence
            </Text>
          </View>
          <Text
            className="font-mono-bold text-sm"
            style={{ color: colors.text }}
          >
            {confidencePct}%
          </Text>
          <Text
            className="font-inter text-[10px] mt-1"
            style={{ color: colors.textMuted }}
          >
            Detection
          </Text>
        </View>

        <View className="flex-1 items-center px-1">
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: peakColor }}
            />
            <Text
              className="font-inter-medium text-[11px]"
              style={{ color: colors.textMuted }}
              numberOfLines={1}
            >
              Peak Shock
            </Text>
          </View>
          <Text
            className="font-mono-bold text-sm"
            style={{ color: colors.text }}
          >
            {peakVal.toFixed(1)}G
          </Text>
          <Text
            className="font-inter text-[10px] mt-1"
            style={{ color: colors.textMuted }}
          >
            Gravity
          </Text>
        </View>
      </View>
    </AppCard>
  );
});
