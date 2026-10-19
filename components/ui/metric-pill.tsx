import React from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/utils";

export interface MetricPillProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  variant?: "light" | "dark" | "outline";
  className?: string;
}

export function MetricPill({
  icon,
  label,
  value,
  subValue,
  variant = "light",
  className,
}: MetricPillProps) {
  const containerStyle = {
    light: "bg-slate-100/90 border border-slate-200/60",
    dark: "bg-slate-800/90 border border-slate-700/60",
    outline: "bg-white border border-slate-200",
  }[variant];

  const labelColor = {
    light: "text-slate-500",
    dark: "text-slate-400",
    outline: "text-slate-500",
  }[variant];

  const valueColor = {
    light: "text-slate-900",
    dark: "text-white",
    outline: "text-slate-900",
  }[variant];

  return (
    <View
      className={cn(
        "flex-1 flex-row items-center gap-2.5 rounded-2xl py-2 px-3",
        containerStyle,
        className
      )}
    >
      <View className="items-center justify-center">{icon}</View>
      <View className="flex-1 justify-center">
        <Text
          numberOfLines={1}
          className={cn("font-quicksand-semibold text-[10px]", labelColor)}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          className={cn("font-quicksand-bold text-xs", valueColor)}
        >
          {value}
        </Text>
        {subValue ? (
          <Text
            numberOfLines={1}
            className="font-quicksand text-[9px] text-slate-400"
          >
            {subValue}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
