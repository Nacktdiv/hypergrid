import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

export interface TopFloatingHeaderProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  transparentBackground?: boolean;
}

export function TopFloatingHeader({
  left,
  center,
  right,
  className,
  transparentBackground = true,
}: TopFloatingHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={cn(
        "absolute inset-x-0 top-0 z-30 flex-row items-center justify-between px-4",
        transparentBackground
          ? "bg-transparent"
          : "bg-white/95 dark:bg-[#10131A]/95 backdrop-blur-md border-b border-slate-100 dark:border-[#232936]",
        className
      )}
      style={{
        paddingTop: Math.max(insets.top, 12) + 6,
        paddingBottom: 10,
      }}
    >
      <View className="items-start justify-center min-w-[44px]">
        {left}
      </View>
      <View className="flex-1 items-center justify-center px-2">
        {center}
      </View>
      <View className="items-end justify-center min-w-[44px]">
        {right}
      </View>
    </View>
  );
}
