import React from "react";
import {
  ActivityIndicator,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

import { useOptionalTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";
import { Touchable } from "./touchable";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "destructive"
  | "circle"
  | "quickAction";

export type ButtonSize = "sm" | "md" | "lg";

export interface AppButtonProps {
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  accessibilityLabel?: string;
}

export function AppButton({
  label,
  variant = "primary",
  size = "lg",
  iconLeft,
  iconRight,
  onPress,
  disabled = false,
  loading = false,
  className,
  accessibilityLabel,
}: AppButtonProps) {
  const { colors } = useOptionalTheme();
  const isCircle = variant === "circle";

  const sizeClasses = {
    sm: "h-9 px-3.5",
    md: "h-11 px-5",
    lg: "h-14 px-6",
  }[size];

  const variantContainerClasses = {
    primary: "bg-brand border-0",
    secondary:
      "bg-slate-100 dark:bg-[#1E2430] border border-slate-200/70 dark:border-[#2B3344]",
    outline:
      "bg-white dark:bg-[#151922] border border-slate-200 dark:border-[#232936]",
    destructive:
      "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30",
    circle:
      "h-12 w-12 rounded-full bg-white dark:bg-[#151922] border border-slate-200/80 dark:border-[#232936] shadow-sm items-center justify-center p-0",
    quickAction:
      "h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-[#1E2430] border border-slate-200/70 dark:border-[#2B3344] flex-row items-center justify-center gap-1.5",
  }[variant];

  const variantTextClasses = {
    primary: "text-white font-inter-bold text-[14px]",
    secondary: "text-slate-800 dark:text-slate-100 font-inter-bold text-sm",
    outline: "text-slate-700 dark:text-slate-200 font-inter-bold text-sm",
    destructive: "text-rose-600 dark:text-rose-400 font-inter-bold text-sm",
    circle: "",
    quickAction: "text-slate-700 dark:text-slate-200 font-inter-semibold text-xs",
  }[variant];

  const content = (
    <View
      className={cn(
        "flex-row items-center justify-center gap-2.5",
        isCircle ? "rounded-full" : "rounded-2xl",
        !isCircle && variant !== "quickAction" && sizeClasses,
        variantContainerClasses,
        disabled && "opacity-50",
        className
      )}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#FFFFFF" : colors.brand}
        />
      ) : (
        <>
          {iconLeft}
          {label ? (
            <Text className={cn("text-center", variantTextClasses)}>
              {label}
            </Text>
          ) : null}
          {iconRight}
        </>
      )}
    </View>
  );

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label || "Button"}
    >
      {content}
    </Touchable>
  );
}
