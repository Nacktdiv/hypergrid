import React from "react";
import { View, type ViewProps } from "react-native";

import { TOKENS } from "@/lib/theme/tokens";
import { cn } from "@/lib/utils";

export type CardVariant = "default" | "subtle" | "active" | "dark" | "sheet";

export interface AppCardProps extends ViewProps {
  variant?: CardVariant;
  children: React.ReactNode;
  className?: string;
}

export function AppCard({
  variant = "default",
  children,
  className,
  style,
  ...props
}: AppCardProps) {
  const variantClasses = {
    default: "bg-white border border-slate-200/80 rounded-card p-4",
    subtle: "bg-slate-100/80 border border-slate-200/60 rounded-card p-3.5",
    active: "bg-sky-50/70 border-2 border-brand rounded-card p-4",
    dark: "bg-slate-900 border border-slate-800 rounded-card p-4",
    sheet: "bg-white rounded-t-sheet border-t border-slate-100 pt-3 pb-6 px-5",
  }[variant];

  const shadowStyle = {
    default: TOKENS.shadows.card,
    subtle: undefined,
    active: TOKENS.shadows.card,
    dark: TOKENS.shadows.card,
    sheet: TOKENS.shadows.sheet,
  }[variant];

  return (
    <View
      className={cn(variantClasses, className)}
      style={[shadowStyle, style]}
      {...props}
    >
      {children}
    </View>
  );
}
