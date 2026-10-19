import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, G } from "react-native-svg";
import { MapPin, Radio } from "lucide-react-native";
import type { PotholeCluster } from "@/types/api";

export interface ClusterRadialCardProps {
  cluster: PotholeCluster;
}

export function ClusterRadialCard({ cluster }: { cluster: PotholeCluster }) {
  const confidencePct = Math.round((cluster.confidence_avg || 0) * 100);
  const detectionCount = cluster.detection_count || 1;
  const severity = cluster.severity || "medium";

  const severityConfig = {
    severe: {
      ratio: 0.95,
      color: "#EF4444",
      label: "SEVERE",
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
    },
    high: {
      ratio: 0.85,
      color: "#EF4444",
      label: "HIGH",
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
    },
    medium: {
      ratio: 0.6,
      color: "#F59E0B",
      label: "MEDIUM",
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    low: {
      ratio: 0.35,
      color: "#10B981",
      label: "LOW",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
  }[severity] || {
    ratio: 0.6,
    color: "#F59E0B",
    label: "MEDIUM",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
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

  return (
    <View className="gap-3.5">
      {/* 1. RADIAL CHART CONTAINER WITH POLAR SPIDERWEB GRID */}
      <View className="rounded-2xl border border-slate-200/90 bg-white p-4 items-center justify-center shadow-xs">
        <View className="flex-row items-center justify-between w-full mb-1">
          <View>
            <Text className="font-chivo-bold text-sm text-slate-900">
              Cluster Severity & AI Analysis
            </Text>
            <Text className="font-quicksand text-[11px] text-slate-600">
              Concentric multi-metric telemetry evaluation
            </Text>
          </View>
          <View
            className={`px-2 py-0.5 rounded-full border ${severityConfig.bg} ${severityConfig.border}`}
          >
            <Text className={`font-mono-bold text-[10px] ${severityConfig.text}`}>
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
                    stroke="#E2E8F0"
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
              r={82}
              stroke="#E2E8F0"
              strokeWidth={1}
              fill="none"
            />

            {/* Colored Arcs */}
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
              stroke="#009EFF"
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
            <Text className="font-mono-bold text-sm text-slate-900 leading-tight">
              {confidencePct}%
            </Text>
            <Text className="font-quicksand-bold text-[9px] text-brand uppercase tracking-wider">
              AI Conf
            </Text>
          </View>
        </View>

        {/* 3-Column Legend */}
        <View className="flex-row divide-x divide-slate-200/80 rounded-xl bg-slate-50 border border-slate-200/70 p-2.5 w-full mt-2">
          <View className="flex-1 items-center px-1">
            <View className="flex-row items-center gap-1 mb-0.5">
              <View
                style={{ backgroundColor: severityConfig.color }}
                className="h-2 w-2 rounded-full"
              />
              <Text
                className="font-quicksand-semibold text-[10px] text-slate-600"
                numberOfLines={1}
              >
                Severity
              </Text>
            </View>
            <Text className="font-mono-bold text-xs text-slate-900">
              {severityConfig.label}
            </Text>
          </View>

          <View className="flex-1 items-center px-1">
            <View className="flex-row items-center gap-1 mb-0.5">
              <View className="h-2 w-2 rounded-full bg-[#009EFF]" />
              <Text
                className="font-quicksand-semibold text-[10px] text-slate-600"
                numberOfLines={1}
              >
                Confidence
              </Text>
            </View>
            <Text className="font-mono-bold text-xs text-slate-900">
              {confidencePct}%
            </Text>
          </View>

          <View className="flex-1 items-center px-1">
            <View className="flex-row items-center gap-1 mb-0.5">
              <View className="h-2 w-2 rounded-full bg-[#38BDF8]" />
              <Text
                className="font-quicksand-semibold text-[10px] text-slate-600"
                numberOfLines={1}
              >
                Detections
              </Text>
            </View>
            <Text className="font-mono-bold text-xs text-slate-900">
              {detectionCount}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. LOCATION & REMEDIATION STATUS ROW */}
      <View className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 gap-2.5">
        <View className="flex-row items-center justify-between border-b border-slate-200/60 pb-2">
          <View className="flex-row items-center gap-1.5">
            <MapPin size={14} color="#64748B" />
            <Text className="font-quicksand-semibold text-xs text-slate-600">
              Coordinates
            </Text>
          </View>
          <Text className="font-mono-bold text-xs text-slate-900">
            {cluster.center_latitude.toFixed(4)}, {cluster.center_longitude.toFixed(4)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Radio size={14} color="#64748B" />
            <Text className="font-quicksand-semibold text-xs text-slate-600">
              Remediation Status
            </Text>
          </View>
          <View className="flex-row items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 border border-sky-200/60">
            <View className="h-1.5 w-1.5 rounded-full bg-brand" />
            <Text className="font-mono-bold text-[11px] text-brand">
              {cluster.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
