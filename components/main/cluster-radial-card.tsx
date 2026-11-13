import { MapPin, Radio } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";

import { useOptionalTheme } from "@/contexts/theme-context";
import type { PotholeCluster } from "@/types/api";

export interface ClusterRadialCardProps {
  cluster: PotholeCluster;
}

export const ClusterRadialCard = React.memo(function ClusterRadialCard({
  cluster,
}: {
  cluster: PotholeCluster;
}) {
  const { isDark, colors } = useOptionalTheme();
  const confidencePct = Math.round((cluster.confidence_avg || 0) * 100);
  const detectionCount = cluster.detection_count || 1;
  const severity = cluster.severity || "medium";

  const severityConfig = {
    severe: {
      ratio: 0.95,
      color: colors.danger,
      label: "SEVERE",
      bg: colors.dangerSoft,
      text: colors.dangerText,
      border: colors.danger,
    },
    high: {
      ratio: 0.85,
      color: colors.danger,
      label: "HIGH",
      bg: colors.dangerSoft,
      text: colors.dangerText,
      border: colors.danger,
    },
    medium: {
      ratio: 0.6,
      color: colors.warning,
      label: "MEDIUM",
      bg: colors.warningSoft,
      text: colors.warningText,
      border: colors.warning,
    },
    low: {
      ratio: 0.35,
      color: colors.success,
      label: "LOW",
      bg: colors.successSoft,
      text: colors.successText,
      border: colors.success,
    },
  }[severity] || {
    ratio: 0.6,
    color: colors.warning,
    label: "MEDIUM",
    bg: colors.warningSoft,
    text: colors.warningText,
    border: colors.warning,
  };

  const outerRatio = severityConfig.ratio;
  const middleRatio = Math.max(0.06, Math.min(1, cluster.confidence_avg || 0));
  const innerRatio = Math.max(0.08, Math.min(1, detectionCount / 5));

  const size = 180;
  const center = size / 2;

  const rOuter = 72;
  const rMiddle = 56;
  const rInner = 40;
  const strokeW = 9;

  const circOuter = 2 * Math.PI * rOuter;
  const circMiddle = 2 * Math.PI * rMiddle;
  const circInner = 2 * Math.PI * rInner;

  const spokeAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  const gridStroke = isDark ? "#232936" : "#E2E8F0";
  const trackStroke = isDark ? "#1E2430" : "#F1F5F9";

  return (
    <View className="gap-3.5">
      {/* 1. RADIAL CHART CONTAINER WITH POLAR SPIDERWEB GRID */}
      <View
        className="rounded-2xl border p-4 items-center justify-center"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        <View className="flex-row items-center justify-between w-full mb-1">
          <View>
            <Text
              className="font-inter-bold text-sm"
              style={{ color: colors.text }}
            >
              Cluster Severity & AI Analysis
            </Text>
            <Text
              className="font-inter text-[11px]"
              style={{ color: colors.textMuted }}
            >
              Concentric multi-metric telemetry evaluation
            </Text>
          </View>
          <View
            className="px-2.5 py-0.5 rounded-full border"
            style={{
              backgroundColor: severityConfig.bg,
              borderColor: severityConfig.border,
            }}
          >
            <Text
              className="font-mono-bold text-[10px]"
              style={{ color: severityConfig.text }}
            >
              {severityConfig.label}
            </Text>
          </View>
        </View>

        <View
          style={{ width: size, height: size }}
          className="items-center justify-center relative my-1"
        >
          <Svg width={size} height={size}>
            {/* Polar Spiderweb Radial Spokes */}
            <G>
              {spokeAngles.map((angle) => {
                const rad = (angle * Math.PI) / 180;
                const x1 = center + 28 * Math.cos(rad);
                const y1 = center + 28 * Math.sin(rad);
                const x2 = center + 82 * Math.cos(rad);
                const y2 = center + 82 * Math.sin(rad);
                return (
                  <Line
                    key={angle}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={gridStroke}
                    strokeWidth={1}
                  />
                );
              })}
            </G>

            {/* Concentric Background Grid Rings */}
            <Circle
              cx={center}
              cy={center}
              r={28}
              stroke={gridStroke}
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
              r={82}
              stroke={gridStroke}
              strokeWidth={1}
              fill="none"
            />

            {/* INNER RING: Report Count */}
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

            {/* MIDDLE RING: AI Confidence */}
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

            {/* OUTER RING: Severity Hazard */}
            <Circle
              cx={center}
              cy={center}
              r={rOuter}
              stroke={severityConfig.color}
              strokeWidth={strokeW}
              fill="none"
              strokeDasharray={`${circOuter} ${circOuter}`}
              strokeDashoffset={circOuter * (1 - outerRatio)}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>

          {/* Center Hole Badge */}
          <View className="absolute items-center justify-center">
            <Text
              className="font-mono-bold text-sm leading-tight"
              style={{ color: colors.text }}
            >
              {confidencePct}%
            </Text>
            <Text
              className="font-inter-bold text-[9px] uppercase tracking-wider"
              style={{ color: colors.brandText }}
            >
              AI Conf
            </Text>
          </View>
        </View>

        {/* 3-Column Legend */}
        <View
          className="flex-row rounded-xl border p-2.5 w-full mt-2"
          style={{
            backgroundColor: colors.cardMuted,
            borderColor: colors.border,
          }}
        >
          <View className="flex-1 items-center px-1">
            <View className="flex-row items-center gap-1 mb-0.5">
              <View
                style={{ backgroundColor: severityConfig.color }}
                className="h-2 w-2 rounded-full"
              />
              <Text
                className="font-inter-semibold text-[10px]"
                style={{ color: colors.textMuted }}
                numberOfLines={1}
              >
                Severity
              </Text>
            </View>
            <Text
              className="font-mono-bold text-xs"
              style={{ color: colors.text }}
            >
              {severityConfig.label}
            </Text>
          </View>

          <View
            className="flex-1 items-center px-1 border-x"
            style={{ borderColor: colors.border }}
          >
            <View className="flex-row items-center gap-1 mb-0.5">
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: colors.brand }}
              />
              <Text
                className="font-inter-semibold text-[10px]"
                style={{ color: colors.textMuted }}
                numberOfLines={1}
              >
                Confidence
              </Text>
            </View>
            <Text
              className="font-mono-bold text-xs"
              style={{ color: colors.text }}
            >
              {confidencePct}%
            </Text>
          </View>

          <View className="flex-1 items-center px-1">
            <View className="flex-row items-center gap-1 mb-0.5">
              <View className="h-2 w-2 rounded-full bg-[#38BDF8]" />
              <Text
                className="font-inter-semibold text-[10px]"
                style={{ color: colors.textMuted }}
                numberOfLines={1}
              >
                Detections
              </Text>
            </View>
            <Text
              className="font-mono-bold text-xs"
              style={{ color: colors.text }}
            >
              {detectionCount}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. LOCATION & REMEDIATION STATUS ROW */}
      <View
        className="rounded-2xl border p-3.5 gap-2.5"
        style={{
          backgroundColor: colors.cardMuted,
          borderColor: colors.border,
        }}
      >
        <View
          className="flex-row items-center justify-between border-b pb-2"
          style={{ borderBottomColor: colors.border }}
        >
          <View className="flex-row items-center gap-1.5">
            <MapPin size={14} color={colors.textMuted} />
            <Text
              className="font-inter-semibold text-xs"
              style={{ color: colors.textMuted }}
            >
              Coordinates
            </Text>
          </View>
          <Text
            className="font-mono-bold text-xs"
            style={{ color: colors.text }}
          >
            {cluster.center_latitude.toFixed(4)},{" "}
            {cluster.center_longitude.toFixed(4)}
          </Text>
        </View>

        <View
          className="flex-row items-center justify-between border-b pb-2"
          style={{ borderBottomColor: colors.border }}
        >
          <View className="flex-row items-center gap-1.5">
            <Radio size={14} color={colors.textMuted} />
            <Text
              className="font-inter-semibold text-xs"
              style={{ color: colors.textMuted }}
            >
              DBSCAN Cluster Area
            </Text>
          </View>
          <View
            className="flex-row items-center gap-1.5 rounded-full px-2.5 py-0.5 border"
            style={{
              backgroundColor: colors.successSoft,
              borderColor: colors.success,
            }}
          >
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors.success }}
            />
            <Text
              className="font-mono-bold text-[10px]"
              style={{ color: colors.successText }}
            >
              ~{cluster.radius_meters || 18}m radius · {cluster.user_count || 1}{" "}
              User(s)
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Radio size={14} color={colors.textMuted} />
            <Text
              className="font-inter-semibold text-xs"
              style={{ color: colors.textMuted }}
            >
              Remediation Status
            </Text>
          </View>
          <View
            className="flex-row items-center gap-1.5 rounded-full px-2.5 py-0.5 border"
            style={{
              backgroundColor: colors.brandSoft,
              borderColor: colors.brandBorder,
            }}
          >
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors.brand }}
            />
            <Text
              className="font-mono-bold text-[11px]"
              style={{ color: colors.brandText }}
            >
              {cluster.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});
