import React from "react";
import { Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { cn } from "@/lib/utils";
import { Touchable } from "./touchable";

export interface ActionRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  rightBadge?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  className?: string;
  accessibilityLabel?: string;
}

export function ActionRow({
  icon,
  title,
  subtitle,
  rightBadge,
  onPress,
  showChevron = true,
  className,
  accessibilityLabel,
}: ActionRowProps) {
  const content = (
    <View
      className={cn(
        "flex-row items-center justify-between py-3 px-3.5 rounded-item bg-slate-50 border border-slate-200/70",
        className
      )}
    >
      <View className="flex-row items-center gap-3 flex-1 mr-2">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200/80 shadow-xs">
          {icon}
        </View>
        <View className="flex-1">
          <Text
            numberOfLines={1}
            className="font-quicksand-bold text-sm text-slate-900"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              className="font-quicksand text-xs text-slate-500"
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-center gap-1.5">
        {rightBadge}
        {showChevron ? <ChevronRight size={16} color="#94A3B8" /> : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {content}
    </Touchable>
  );
}
