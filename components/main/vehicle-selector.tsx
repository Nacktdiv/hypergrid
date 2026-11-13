import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import {
  VEHICLE_PROFILES,
  type VehicleId,
  type VehicleProfile,
} from "@/contexts/vehicle-context";
import { cn } from "@/lib/utils";

import { VEHICLE_OPTIONS } from "./mock-data";

export interface VehicleSelectorProps {
  selected: VehicleId;
  onSelect: (id: VehicleId) => void;
  className?: string;
}

export function VehicleSelector({
  selected,
  onSelect,
  className,
}: VehicleSelectorProps) {
  const activeProfile: VehicleProfile =
    VEHICLE_PROFILES[selected] ?? VEHICLE_PROFILES.car;

  return (
    <View className={cn("gap-6", className)}>
      {/* VEHICLE INFO ROW */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-xs text-muted-foreground">
            {activeProfile.standardCategory}
          </Text>
          <Text
            numberOfLines={1}
            className="font-chivo-bold text-xl text-brand"
          >
            {activeProfile.name}
          </Text>
          {/* <Text className="font-quicksand text-xs text-slate-500 mt-0.5">
            Plate: {activeProfile.plate}
          </Text> */}
        </View>

        <View className="h-14 w-20 items-center justify-center">
          <Image
            source={activeProfile.image}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            transition={200}
          />
        </View>
      </View>

      {/* SPEC METRIC PILLS (CLEAN SANS TYPOGRAPHY, SYNCHRONIZED BRAND COLOR) */}
      {/* <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-2 border border-slate-200/60">
          <Zap size={14} color={TOKENS.colors.brand.DEFAULT} />
          <View>
            <Text className="font-quicksand text-[11px] text-slate-500">
              Shock Thresh
            </Text>
            <Text className="font-quicksand-bold text-xs text-slate-900">
              {activeProfile.sensorConfig.zShockThreshold}G
            </Text>
          </View>
        </View>

        <View className="flex-1 flex-row items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-2 border border-slate-200/60">
          <Activity size={14} color={TOKENS.colors.brand.DEFAULT} />
          <View>
            <Text className="font-quicksand text-[11px] text-slate-500">
              Speed Gate
            </Text>
            <Text className="font-quicksand-bold text-xs text-slate-900">
              &gt; {activeProfile.sensorConfig.minMovingSpeed} km/h
            </Text>
          </View>
        </View>
      </View> */}

      {/* VEHICLE SWITCHER PILLS */}
      <View className="flex-row items-center justify-between gap-2 mt-1">
        {VEHICLE_OPTIONS.map((option) => {
          const isActive = selected === option.id;
          return (
            <Pressable
              key={option.id}
              className="flex-1 active:opacity-80 active:scale-95"
              onPress={() => onSelect(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Select vehicle ${option.label}`}
            >
              <View
                className={cn(
                  "overflow-hidden rounded-xl border transition-colors",
                  isActive
                    ? "border-brand bg-brand/10"
                    : "border-border bg-card",
                )}
              >
                {/* Area Gambar / Ikon */}
                <View className="items-center justify-center py-4">
                  <Image
                    source={option.image}
                    style={{ width: 52, height: 48 }}
                    contentFit="contain"
                  />
                </View>

                {/* Footer Label */}
                <View
                  className={cn(
                    "items-center justify-center border-t py-1.5 px-2",
                    isActive
                      ? "border-brand bg-brand"
                      : "border-border bg-muted/30",
                  )}
                >
                  <Text
                    className={cn(
                      "text-xs font-medium",
                      isActive ? "text-brand-light" : "text-foreground",
                    )}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
