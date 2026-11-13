import React from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export interface StatusBadgeProps {
  label: string;
  icon?: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function StatusBadge({
  label,
  icon,
  variant = "neutral",
  className,
}: StatusBadgeProps) {
  const variantStyles = {
    brand:
      "bg-sky-50 dark:bg-sky-500/15 border-sky-200 dark:border-sky-500/30",
    success:
      "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30",
    warning:
      "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30",
    danger:
      "bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30",
    neutral:
      "bg-slate-100 dark:bg-[#1E2430] border-slate-200 dark:border-[#2B3344]",
  }[variant];

  const textColor = {
    brand: "text-brand dark:text-sky-400",
    success: "text-emerald-700 dark:text-emerald-300",
    warning: "text-amber-700 dark:text-amber-300",
    danger: "text-rose-700 dark:text-rose-300",
    neutral: "text-slate-700 dark:text-slate-200",
  }[variant];

  return (
    <View
      className={cn(
        "flex-row items-center gap-1 rounded-full border px-2.5 py-0.5",
        variantStyles,
        className
      )}
    >
      {icon}
      <Text className={cn("font-mono-bold text-[10px] uppercase", textColor)}>
        {label}
      </Text>
    </View>
  );
}
