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
    light:
      "bg-slate-100/90 dark:bg-[#1E2430] border border-slate-200/60 dark:border-[#2B3344]",
    dark: "bg-[#1A1F2B] border border-[#2B3344]",
    outline:
      "bg-white dark:bg-[#151922] border border-slate-200 dark:border-[#232936]",
  }[variant];

  const labelColor = {
    light: "text-slate-500 dark:text-slate-400",
    dark: "text-slate-400",
    outline: "text-slate-500 dark:text-slate-400",
  }[variant];

  const valueColor = {
    light: "text-slate-900 dark:text-slate-50",
    dark: "text-white",
    outline: "text-slate-900 dark:text-slate-50",
  }[variant];

  return (
    <View
      className={cn(
        "flex-1 flex-row items-center gap-2.5 rounded-2xl py-2.5 px-3",
        containerStyle,
        className
      )}
    >
      <View className="items-center justify-center">{icon}</View>
      <View className="flex-1 justify-center">
        <Text
          numberOfLines={1}
          className={cn("font-inter-semibold text-[10px]", labelColor)}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          className={cn("font-inter-bold text-xs mt-0.5", valueColor)}
        >
          {value}
        </Text>
        {subValue ? (
          <Text
            numberOfLines={1}
            className="font-inter text-[10px] text-slate-500 dark:text-slate-400 mt-0.5"
          >
            {subValue}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
