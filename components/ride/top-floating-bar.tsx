import { AlertTriangle, ChevronLeft, Navigation } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/components/ui/app-button";
import { useOptionalTheme } from "@/contexts/theme-context";

export interface TopFloatingBarProps {
  onBack?: () => void;
  onOpenEmergency?: () => void;
  destinationName?: string;
  remainingDistanceMeters?: number | null;
}

export const TopFloatingBar = React.memo(function TopFloatingBar({
  onBack,
  onOpenEmergency,
  destinationName,
  remainingDistanceMeters,
}: TopFloatingBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useOptionalTheme();

  return (
    <View
      className="absolute top-0 inset-x-0 z-30 flex-row items-center justify-between px-4"
      style={{
        paddingTop: Math.max(insets.top, 12) + 6,
      }}
    >
      <AppButton
        variant="circle"
        size="sm"
        onPress={onBack}
        iconLeft={<ChevronLeft size={22} color={colors.text} />}
        accessibilityLabel="Back to start screen"
      />

      {destinationName ? (
        <View
          className="flex-1 mx-2.5 flex-row items-center justify-between h-11 px-3 rounded-full border shadow-sm"
          style={{
            backgroundColor: isDark
              ? "rgba(21, 25, 34, 0.94)"
              : "rgba(255, 255, 255, 0.95)",
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center gap-2 flex-1 pr-1.5">
            <View
              className="h-6 w-6 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.brandSoft }}
            >
              <Navigation size={12} color={colors.brand} />
            </View>
            <Text
              className="font-inter-bold text-xs flex-1"
              style={{ color: colors.text }}
              numberOfLines={1}
            >
              {destinationName}
            </Text>
          </View>

          {remainingDistanceMeters !== null &&
          remainingDistanceMeters !== undefined ? (
            <View
              className="px-2 py-0.5 rounded-md border"
              style={{
                backgroundColor: colors.brandSoft,
                borderColor: colors.brandBorder,
              }}
            >
              <Text
                className="font-mono-bold text-[10px]"
                style={{ color: colors.brandText }}
              >
                {remainingDistanceMeters >= 1000
                  ? `${(remainingDistanceMeters / 1000).toFixed(1)} km`
                  : `${Math.round(remainingDistanceMeters)} m`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="flex-1" />
      )}

      {onOpenEmergency ? (
        <Pressable
          onPress={onOpenEmergency}
          accessibilityRole="button"
          accessibilityLabel="Open Emergency Assistance Center"
          className="h-11 w-11 rounded-full bg-rose-600 border border-rose-700 items-center justify-center shadow-xs active:opacity-90"
        >
          <View className="items-center justify-center">
            <AlertTriangle size={15} color="#FFFFFF" strokeWidth={2.5} />
            <Text className="font-inter-extrabold text-[8px] text-white tracking-wider mt-0.5">
              SOS
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
});
