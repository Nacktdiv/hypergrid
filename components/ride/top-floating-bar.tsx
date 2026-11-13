import { AlertTriangle, ChevronLeft, Navigation } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/components/ui/app-button";
import { TOKENS } from "@/lib/theme/tokens";

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

  return (
    <View
      className="absolute top-0 inset-x-0 z-30 flex-row items-center justify-between px-4"
      style={{
        paddingTop: Math.max(insets.top, 12) + 6,
      }}
    >
      {/* Tombol Kembali */}
      <AppButton
        variant="circle"
        size="sm"
        onPress={onBack}
        iconLeft={<ChevronLeft size={22} color={TOKENS.colors.slate[800]} />}
        accessibilityLabel="Back to start screen"
      />

      {/* Live Destination & Distance Navigation Capsule */}
      {destinationName ? (
        <View className="flex-1 mx-2.5 flex-row items-center justify-between h-11 px-3 rounded-full bg-white/95 border border-slate-200/90 shadow-sm">
          <View className="flex-row items-center gap-1.5 flex-1 pr-1.5">
            <View className="h-6 w-6 rounded-full bg-sky-50 items-center justify-center">
              <Navigation size={12} color="#1DA1F2" />
            </View>
            <Text
              className="font-quicksand-bold text-xs text-slate-900 flex-1"
              numberOfLines={1}
            >
              {destinationName}
            </Text>
          </View>

          {remainingDistanceMeters !== null &&
          remainingDistanceMeters !== undefined ? (
            <View className="px-2 py-0.5 rounded-md bg-sky-50 border border-sky-100">
              <Text className="font-mono-bold text-[10px] text-sky-700">
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

      {/* Quick Emergency SOS Button */}
      {onOpenEmergency ? (
        <Pressable
          onPress={onOpenEmergency}
          accessibilityRole="button"
          accessibilityLabel="Open Emergency Assistance Center"
          className="h-11 w-11 rounded-full bg-rose-600 border border-rose-700 items-center justify-center shadow-xs active:bg-rose-700"
        >
          <View className="items-center justify-center">
            <AlertTriangle size={15} color="#FFFFFF" strokeWidth={2.5} />
            <Text className="font-chivo-bold text-[8px] text-white tracking-wider mt-0.5">
              SOS
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
});
