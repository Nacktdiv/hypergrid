import React from "react";
import { View, type ViewProps } from "react-native";

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
    default:
      "bg-white dark:bg-[#151922] border border-slate-200/80 dark:border-[#232936] rounded-card p-4",
    subtle:
      "bg-slate-100/80 dark:bg-[#1E2430] border border-slate-200/60 dark:border-[#2B3344] rounded-card p-3.5",
    active:
      "bg-sky-50/70 dark:bg-sky-950/35 border-2 border-brand rounded-card p-4",
    dark: "bg-[#151922] border border-[#232936] rounded-card p-4",
    sheet:
      "bg-white dark:bg-[#10131A] rounded-t-sheet border-t border-slate-100 dark:border-[#232936] pt-3 pb-6 px-5",
  }[variant];

  return (
    <View
      className={cn(variantClasses, className)}
      style={[style]}
      {...props}
    >
      {children}
    </View>
  );
}
