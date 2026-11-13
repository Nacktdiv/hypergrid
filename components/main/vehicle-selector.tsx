import { Image } from "expo-image";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { useOptionalTheme } from "@/contexts/theme-context";
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

const VEHICLE_LABELS: Record<VehicleId, string> = {
  car: "Passenger Car",
  motor: "Motorcycle",
  bicycle: "Bicycle",
};

export const VehicleSelector = React.memo(function VehicleSelector({
  selected,
  onSelect,
  className,
}: VehicleSelectorProps) {
  const { colors } = useOptionalTheme();
  const activeProfile: VehicleProfile =
    VEHICLE_PROFILES[selected] ?? VEHICLE_PROFILES.car;

  return (
    <View className={cn("gap-3.5", className)}>
      {/* CALIBRATION SUMMARY CARD */}
      <View
        className="flex-row items-center justify-between rounded-2xl px-4 py-3 border"
        style={{
          backgroundColor: colors.cardMuted,
          borderColor: colors.border,
        }}
      >
        <View className="flex-1 mr-3">
          <Text
            numberOfLines={1}
            className="font-inter-bold text-base"
            style={{ color: colors.text }}
          >
            {activeProfile.name}
          </Text>
          <Text
            numberOfLines={1}
            className="font-inter text-xs mt-1"
            style={{ color: colors.textMuted }}
          >
            {VEHICLE_LABELS[selected] ?? VEHICLE_LABELS.car}
            {activeProfile.plate ? ` · ${activeProfile.plate}` : ""}
          </Text>
        </View>

        <View className="h-12 w-16 items-center justify-center">
          <Image
            source={activeProfile.image}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            transition={150}
          />
        </View>
      </View>

      {/* VEHICLE SWITCHER TILES */}
      <View className="flex-row items-center justify-between gap-2.5">
        {VEHICLE_OPTIONS.map((option) => {
          const isActive = selected === option.id;
          return (
            <Pressable
              key={option.id}
              className="flex-1 active:opacity-85"
              onPress={() => onSelect(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Select vehicle ${option.label}`}
            >
              <View
                className="overflow-hidden rounded-2xl border items-center pt-3 pb-2 px-2"
                style={{
                  backgroundColor: isActive ? colors.brandSoft : colors.cardMuted,
                  borderColor: isActive ? colors.brand : colors.border,
                }}
              >
                <Image
                  source={option.image}
                  style={{ width: 46, height: 38 }}
                  contentFit="contain"
                />

                <Text
                  className="font-inter-bold text-xs mt-2"
                  style={{
                    color: isActive ? colors.brandText : colors.textSecondary,
                  }}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>

                {/* Active Bottom Indicator Pill */}
                <View
                  className="h-1 rounded-full mt-2"
                  style={{
                    width: isActive ? 28 : 0,
                    backgroundColor: isActive ? colors.brand : "transparent",
                  }}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});
