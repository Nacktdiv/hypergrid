import { Zap } from "lucide-react-native";
import { Text, View } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";

import { AppCard } from "@/components/ui/app-card";
import { TOKENS } from "@/lib/theme/tokens";
import type { Metric } from "./mock-data";

/**
 * Radial Chart - Grid (Inspired by shadcn/ui Radial Chart & Swiss Design).
 *
 * Menggantikan 3 kartu kotak menjadi satu kartu visual radial konsentris:
 * - Outer Ring: G-Force Peak (Skala 0.0G - 3.0G) - Deep Blue (#1D4ED8)
 * - Middle Ring: AI Confidence (Skala 0% - 100%) - Brand Blue (#1DA1F2)
 * - Inner Ring: Anomaly Points (Skala 0 - 10+ Lokasi) - Sky Blue (#38BDF8)
 * - Spiderweb Polar Grid: Lingkaran & garis spoke radial halus (#E2E8F0)
 */
export function MetricsSummary({ metrics }: { metrics: Metric[] }) {
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

  // Normalisasi sudut lingkaran (0.05 minimum agar tetap tampak titik awal jika 0)
  const outerRatio = Math.min(
    1,
    Math.max(peakVal > 0 ? 0.08 : 0.03, peakVal / 3.0),
  );
  const middleRatio = Math.min(
    1,
    Math.max(confidencePct > 0 ? 0.08 : 0.03, confidencePct / 100),
  );
  const innerRatio = Math.min(
    1,
    Math.max(anomalyCount > 0 ? 0.08 : 0.03, anomalyCount / 10),
  );

  const size = 200;
  const center = size / 2;

  // Radii untuk 3 ring
  const rOuter = 82;
  const rMiddle = 65;
  const rInner = 48;
  const strokeW = 10;

  const circOuter = 2 * Math.PI * rOuter;
  const circMiddle = 2 * Math.PI * rMiddle;
  const circInner = 2 * Math.PI * rInner;

  // Sudut radial grid (8 arah mata angin)
  const spokeAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <AppCard variant="default" className="p-5 gap-4">
      {/* CARD HEADER */}
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="font-chivo-bold text-sm text-gray-900">
            Telemetry Radial Index
          </Text>
          <Text className="font-quicksand text-[13px] text-muted-foreground mt-0.5">
            Radial sensor vibration & AI model metrics
          </Text>
        </View>
      </View>

      {/* CENTER RADIAL CHART (CONCENTRIC ARCS WITH POLAR GRID) */}
      <View className="items-center justify-center py-4">
        <View
          style={{ width: size, height: size }}
          className="items-center justify-center relative"
        >
          <Svg width={size} height={size}>
            {/* 1. POLAR SPIDERWEB GRID (RADIAL SPOKES) */}
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
                    stroke="#E2E8F0"
                    strokeWidth={1}
                  />
                );
              })}
            </G>

            {/* 2. POLAR CONCENTRIC GRID CIRCLES */}
            <Circle
              cx={center}
              cy={center}
              r={35}
              stroke="#E2E8F0"
              strokeWidth={1}
              fill="none"
            />
            <Circle
              cx={center}
              cy={center}
              r={48}
              stroke="#F1F5F9"
              strokeWidth={strokeW}
              fill="none"
            />
            <Circle
              cx={center}
              cy={center}
              r={65}
              stroke="#F1F5F9"
              strokeWidth={strokeW}
              fill="none"
            />
            <Circle
              cx={center}
              cy={center}
              r={82}
              stroke="#F1F5F9"
              strokeWidth={strokeW}
              fill="none"
            />
            <Circle
              cx={center}
              cy={center}
              r={95}
              stroke="#E2E8F0"
              strokeWidth={1}
              fill="none"
            />

            {/* 3. CONCENTRIC COLORED ARCS */}
            {/* INNER RING: Anomaly Points */}
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
              stroke={TOKENS.colors.brand.DEFAULT}
              strokeWidth={strokeW}
              fill="none"
              strokeDasharray={`${circMiddle} ${circMiddle}`}
              strokeDashoffset={circMiddle * (1 - middleRatio)}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />

            {/* OUTER RING: G-Force Peak */}
            <Circle
              cx={center}
              cy={center}
              r={rOuter}
              stroke="#1D4ED8"
              strokeWidth={strokeW}
              fill="none"
              strokeDasharray={`${circOuter} ${circOuter}`}
              strokeDashoffset={circOuter * (1 - outerRatio)}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>

          {/* INNER HOLE STAT BADGE */}
          <View className="absolute items-center justify-center">
            <Zap size={20} color={TOKENS.colors.brand.DEFAULT} />
            <Text className="font-mono-bold text-xs text-gray-800 mt-0.5">
              {peakVal > 0 ? `${peakVal}G` : "0.0G"}
            </Text>
          </View>
        </View>
      </View>

      {/* METRIC BREAKDOWN LEGEND (HIGH-CONTRAST SWISS GRID) */}
      <View className="flex-row divide-x divide-gray rounded-2xl bg-gray-50 border border-gray-200/70 p-3">
        {/* Ring 1 Legend */}
        <View className="flex-1 items-center px-1">
          <View className="flex-row items-center gap-1.5 mb-2">
            <View className="h-1.5 w-1.5 rounded-full bg-[#38BDF8]" />
            <Text
              className=" text-[10px] text-muted-foreground font-medium"
              numberOfLines={1}
            >
              Anomalies
            </Text>
          </View>
          <Text className="font-mono-bold text-sm text-gray-900">
            {anomalyCount}
          </Text>
          <Text className="font-quicksand text-[10px] text-gray-500 mt-2">
            Locations
          </Text>
        </View>

        {/* Ring 2 Legend */}
        <View className="flex-1 items-center px-1">
          <View className="flex-row items-center gap-1.5 mb-2">
            <View className="h-1.5 w-1.5 rounded-full bg-brand" />
            <Text
              className=" text-[10px] text-muted-foreground font-medium"
              numberOfLines={1}
            >
              Confidence
            </Text>
          </View>
          <Text className="font-mono-bold text-sm text-gray-900">
            {confidencePct}%
          </Text>
          <Text className="font-quicksand text-[10px] text-gray-500 mt-2">
            HypeLN Score
          </Text>
        </View>

        {/* Ring 3 Legend */}
        <View className="flex-1 items-center px-1">
          <View className="flex-row items-center gap-1.5 mb-2">
            <View className="h-1.5 w-1.5 rounded-full bg-[#1D4ED8]" />
            <Text
              className=" text-[10px] text-muted-foreground font-medium"
              numberOfLines={1}
            >
              Peak Shock
            </Text>
          </View>
          <Text className="font-mono-bold text-sm text-gray-900">
            {peakVal.toFixed(1)}G
          </Text>
          <Text className="font-quicksand text-[10px] text-gray-500 mt-2">
            Gravity
          </Text>
        </View>
      </View>
    </AppCard>
  );
}
