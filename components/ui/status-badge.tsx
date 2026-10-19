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
    brand: "bg-sky-50 border-sky-200 text-brand",
    success: "bg-emerald-50 border-emerald-200 text-emerald-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    danger: "bg-rose-50 border-rose-200 text-rose-700",
    neutral: "bg-slate-100 border-slate-200 text-slate-700",
  }[variant];

  const textColor = {
    brand: "text-brand",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-rose-700",
    neutral: "text-slate-700",
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
