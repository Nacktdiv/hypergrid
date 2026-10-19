import React from "react";
import { View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/components/ui/app-button";
import { TOKENS } from "@/lib/theme/tokens";

export interface TopFloatingBarProps {
  onBack?: () => void;
}

export const TopFloatingBar = React.memo(function TopFloatingBar({
  onBack,
}: TopFloatingBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute top-0 left-0 z-30 px-4"
      style={{
        paddingTop: Math.max(insets.top, 12) + 6,
      }}
    >
      <AppButton
        variant="circle"
        size="sm"
        onPress={onBack}
        iconLeft={
          <ChevronLeft size={22} color={TOKENS.colors.slate[800]} />
        }
        accessibilityLabel="Back to start screen"
      />
    </View>
  );
});

