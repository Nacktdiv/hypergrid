import React from "react";
import { Text, View } from "react-native";
import { AlertTriangle, ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/components/ui/app-button";
import { Touchable } from "@/components/ui/touchable";
import { TOKENS } from "@/lib/theme/tokens";

export interface TopFloatingBarProps {
  onBack?: () => void;
  onOpenEmergency?: () => void;
}

export const TopFloatingBar = React.memo(function TopFloatingBar({
  onBack,
  onOpenEmergency,
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
        iconLeft={
          <ChevronLeft size={22} color={TOKENS.colors.slate[800]} />
        }
        accessibilityLabel="Back to start screen"
      />

      {/* Tombol SOS Darurat Cepat */}
      {onOpenEmergency ? (
        <Touchable
          onPress={onOpenEmergency}
          accessibilityRole="button"
          accessibilityLabel="Buka Pusat Bantuan Darurat SOS"
          className="flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-rose-600 border border-white/80 shadow-lg shadow-rose-600/40"
        >
          <View className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <AlertTriangle size={15} color="#FFFFFF" strokeWidth={2.5} />
          <Text className="font-chivo-bold text-xs text-white tracking-wider">
            SOS
          </Text>
        </Touchable>
      ) : null}
    </View>
  );
});
