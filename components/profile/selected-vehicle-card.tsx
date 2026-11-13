import React from "react";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import { Activity, Zap } from "lucide-react-native";

import { AppCard } from "@/components/ui/app-card";
import { MetricPill } from "@/components/ui/metric-pill";
import { useOptionalTheme } from "@/contexts/theme-context";
import { useVehicle } from "@/contexts/vehicle-context";

export const SelectedVehicleCard = React.memo(function SelectedVehicleCard() {
  const { vehicleProfile } = useVehicle();
  const { colors, isDark } = useOptionalTheme();

  return (
    <AppCard
      variant="default"
      className="p-4 gap-3"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          <Text
            className="font-inter-semibold text-[11px] uppercase tracking-wider"
            style={{ color: colors.textMuted }}
          >
            Active Vehicle
          </Text>
          <Text
            className="font-inter-bold text-lg mt-0.5"
            style={{ color: colors.text }}
          >
            {vehicleProfile.name}
          </Text>
          <Text
            className="font-mono text-xs mt-0.5"
            style={{ color: colors.textMuted }}
          >
            Plate: {vehicleProfile.plate}
          </Text>
        </View>

        <View
          className="h-16 w-24 items-center justify-center rounded-xl border p-1"
          style={{
            backgroundColor: colors.cardMuted,
            borderColor: colors.border,
          }}
        >
          <Image
            source={vehicleProfile.image}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            transition={200}
          />
        </View>
      </View>

      <View
        className="flex-row items-center gap-2 pt-2 border-t"
        style={{ borderTopColor: colors.border }}
      >
        <MetricPill
          icon={<Zap size={14} color={colors.brand} />}
          label="Shock Thresh"
          value={`${vehicleProfile.sensorConfig.zShockThreshold.toFixed(2)}G`}
          variant={isDark ? "dark" : "light"}
        />
        <MetricPill
          icon={<Activity size={14} color={colors.brand} />}
          label="Speed Gate"
          value={`>${vehicleProfile.sensorConfig.minMovingSpeed} km/h`}
          variant={isDark ? "dark" : "light"}
        />
      </View>
    </AppCard>
  );
});
