import React from "react";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import { Activity, Zap } from "lucide-react-native";

import { AppCard } from "@/components/ui/app-card";
import { MetricPill } from "@/components/ui/metric-pill";
import { useVehicle } from "@/contexts/vehicle-context";
import { TOKENS } from "@/lib/theme/tokens";

export function SelectedVehicleCard() {
  const { vehicleProfile } = useVehicle();

  return (
    <AppCard variant="default" className="p-4 gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          <Text className="font-quicksand-bold text-[11px] tracking-wider uppercase text-brand">
            Active Telemetry Vehicle
          </Text>
          <Text className="font-chivo-bold text-lg text-slate-900 mt-0.5">
            {vehicleProfile.name}
          </Text>
          <Text className="font-quicksand-semibold text-xs text-slate-600 mt-0.5">
            Plate: {vehicleProfile.plate}
          </Text>
        </View>

        <View className="h-16 w-24 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 p-1">
          <Image
            source={vehicleProfile.image}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            transition={200}
          />
        </View>
      </View>

      <View className="flex-row items-center gap-2 pt-1 border-t border-slate-100">
        <MetricPill
          icon={<Zap size={14} color={TOKENS.colors.brand.DEFAULT} />}
          label="Shock Thresh"
          value={`${vehicleProfile.sensorConfig.zShockThreshold}G`}
          variant="light"
        />
        <MetricPill
          icon={<Activity size={14} color={TOKENS.colors.brand.DEFAULT} />}
          label="Speed Gate"
          value={`>${vehicleProfile.sensorConfig.minMovingSpeed} km/h`}
          variant="light"
        />
      </View>
    </AppCard>
  );
}
