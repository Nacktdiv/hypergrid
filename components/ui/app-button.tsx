import React from "react";
import {
  ActivityIndicator,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

import { TOKENS } from "@/lib/theme/tokens";
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
  const isCircle = variant === "circle";

  const sizeClasses = {
    sm: "h-9 px-3.5",
    md: "h-11 px-5",
    lg: "h-14 px-6",
  }[size];

  const variantContainerClasses = {
    primary: "bg-brand border-0 shadow-md",
    secondary: "bg-slate-100 border border-slate-200/60",
    outline: "bg-white border border-slate-200",
    destructive: "bg-rose-50 border border-rose-200",
    circle: "h-12 w-12 rounded-full bg-white border border-slate-200/80 shadow-sm items-center justify-center p-0",
    quickAction: "h-10 px-3.5 rounded-full bg-slate-100 border border-slate-200/60 flex-row items-center justify-center gap-1.5",
  }[variant];

  const variantTextClasses = {
    primary: "text-white font-quicksand-bold text-base",
    secondary: "text-slate-800 font-quicksand-bold text-sm",
    outline: "text-slate-700 font-quicksand-bold text-sm",
    destructive: "text-rose-600 font-quicksand-bold text-sm",
    circle: "",
    quickAction: "text-slate-700 font-quicksand-semibold text-xs",
  }[variant];

  const content = (
    <View
      className={cn(
        "flex-row items-center justify-center gap-2.5",
        isCircle ? "rounded-full" : "rounded-pill",
        !isCircle && variant !== "quickAction" && sizeClasses,
        variantContainerClasses,
        disabled && "opacity-50",
        className
      )}
      style={variant === "primary" ? TOKENS.shadows.glow : undefined}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#FFFFFF" : TOKENS.colors.brand.DEFAULT}
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
