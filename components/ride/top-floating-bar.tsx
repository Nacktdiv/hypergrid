import React from "react";
import { Text, View } from "react-native";
import { ChevronLeft, HelpCircle } from "lucide-react-native";

import { AppButton } from "@/components/ui/app-button";
import { TopFloatingHeader } from "@/components/ui/top-floating-header";
import { TOKENS } from "@/lib/theme/tokens";

export interface TopFloatingBarProps {
  onBack?: () => void;
  onHelp?: () => void;
  title?: string;
}

export function TopFloatingBar({
  onBack,
  onHelp,
  title = "Ride in progress",
}: TopFloatingBarProps) {
  return (
    <TopFloatingHeader
      left={
        <AppButton
          variant="circle"
          size="sm"
          onPress={onBack}
          iconLeft={
            <ChevronLeft size={22} color={TOKENS.colors.slate[800]} />
          }
          accessibilityLabel="Back to start screen"
        />
      }
      center={
        <View
          className="flex-row items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-800"
          style={TOKENS.shadows.card}
        >
          <View className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <Text className="font-chivo-bold text-sm text-white tracking-wide">
            {title}
          </Text>
        </View>
      }
      right={
        <AppButton
          variant="circle"
          size="sm"
          onPress={onHelp}
          iconLeft={
            <HelpCircle size={20} color={TOKENS.colors.slate[800]} />
          }
          accessibilityLabel="Ride instructions and telemetry help"
        />
      }
    />
  );
}
