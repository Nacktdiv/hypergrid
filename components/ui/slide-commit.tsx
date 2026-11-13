import * as Haptics from "expo-haptics";
import { Check, ChevronsRight, TriangleAlert } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useOptionalTheme } from "@/contexts/theme-context";

export type SlideCommitPhase = "idle" | "pending" | "done" | "error";

export interface SlideCommitProps {
  label?: string;
  doneLabel?: string;
  errorLabel?: string;
  onConfirm?: () => void | Promise<unknown>;
  onDone?: () => void;
  onError?: (reason: unknown) => void;
  trackColor?: string;
  idleTrackColor?: string;
  handleColor?: string;
  successColor?: string;
  dangerColor?: string;
  height?: number;
  width?: number;
  radius?: number;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const PAD = 4;

export function SlideCommit({
  label = "Slide to start ride",
  doneLabel = "Starting Ride...",
  errorLabel = "Failed to start",
  onConfirm,
  onDone,
  onError,
  trackColor,
  idleTrackColor,
  handleColor,
  successColor,
  dangerColor,
  height = 56,
  width,
  radius,
  disabled = false,
  icon,
  className = "",
}: SlideCommitProps) {
  const { isDark, colors } = useOptionalTheme();
  const resolvedTrackColor = trackColor ?? colors.brand;
  const resolvedIdleTrackColor =
    idleTrackColor ?? (isDark ? "#1E2430" : "#E8EEF5");
  const resolvedHandleColor = handleColor ?? colors.brand;
  const resolvedSuccessColor = successColor ?? "#10B981";
  const resolvedDangerColor = dangerColor ?? "#EF4444";

  const [phase, setPhase] = useState<SlideCommitPhase>("idle");
  const [containerWidth, setContainerWidth] = useState<number>(width || 0);

  const GRIP = height - PAD * 2;
  const r = radius !== undefined ? radius : height / 2;
  const gripRadius = Math.max(0, r - PAD);

  const actualWidth = width || containerWidth;
  const TRAVEL = Math.max(1, actualWidth - PAD * 2 - GRIP);

  const translateX = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const travelSV = useSharedValue(TRAVEL);
  const widthSV = useSharedValue(Math.max(GRIP + PAD * 2, actualWidth));
  const lockedSV = useSharedValue(disabled);

  useEffect(() => {
    travelSV.set(TRAVEL);
    widthSV.set(Math.max(GRIP + PAD * 2, actualWidth));
  }, [TRAVEL, GRIP, actualWidth, travelSV, widthSV]);

  useEffect(() => {
    lockedSV.set(disabled || phase === "pending" || phase === "done");
  }, [disabled, phase, lockedSV]);

  const triggerHaptic = useCallback(
    (type: "light" | "medium" | "success" | "error") => {
      try {
        if (type === "light") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (type === "medium") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (type === "success") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (type === "error") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch {
        // Ignore on devices/simulators without haptic hardware
      }
    },
    []
  );

  const shakeAnimation = useCallback(() => {
    shakeX.set(
      withSequence(
        withTiming(-8, { duration: 40 }),
        withTiming(8, { duration: 40 }),
        withTiming(-6, { duration: 40 }),
        withTiming(6, { duration: 40 }),
        withTiming(-3, { duration: 40 }),
        withTiming(0, { duration: 40 })
      )
    );
  }, [shakeX]);

  const snapHome = useCallback(() => {
    translateX.set(
      withSpring(0, {
        damping: 18,
        stiffness: 260,
        mass: 0.7,
      })
    );
  }, [translateX]);

  const resetToIdle = useCallback(() => {
    translateX.set(0);
    setPhase("idle");
  }, [translateX]);

  useEffect(() => {
    if (phase === "done") {
      const timer = setTimeout(resetToIdle, 350);
      return () => clearTimeout(timer);
    }
    if (phase === "error") {
      const timer = setTimeout(() => {
        snapHome();
        setPhase("idle");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, resetToIdle, snapHome]);

  const commit = useCallback(async () => {
    triggerHaptic("medium");

    let result: void | Promise<unknown>;
    try {
      result = onConfirm?.();
    } catch (err) {
      triggerHaptic("error");
      setPhase("error");
      onError?.(err);
      shakeAnimation();
      return;
    }

    const isPromise =
      result && typeof (result as Promise<unknown>).then === "function";

    if (!isPromise) {
      triggerHaptic("success");
      setPhase("done");
      onDone?.();
      return;
    }

    setPhase("pending");
    try {
      await result;
      triggerHaptic("success");
      setPhase("done");
      onDone?.();
    } catch (err) {
      triggerHaptic("error");
      setPhase("error");
      onError?.(err);
      shakeAnimation();
    }
  }, [triggerHaptic, onConfirm, onDone, onError, shakeAnimation]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled && phase !== "pending" && phase !== "done")
        .activeOffsetX([-3, 3])
        .onStart(() => {
          "worklet";
          if (lockedSV.get()) return;
          dragStartX.set(translateX.get());
          scheduleOnRN(triggerHaptic, "light");
        })
        .onUpdate((event) => {
          "worklet";
          if (lockedSV.get()) return;
          const travel = travelSV.get();
          const nextX = Math.min(
            Math.max(0, dragStartX.get() + event.translationX),
            travel
          );
          translateX.set(nextX);
        })
        .onEnd((event) => {
          "worklet";
          if (lockedSV.get()) return;
          const travel = travelSV.get();
          const currentX = Math.min(
            Math.max(0, dragStartX.get() + event.translationX),
            travel
          );

          if (currentX >= travel * 0.85 || event.velocityX > 800) {
            translateX.set(withTiming(travel, { duration: 75 }));
            scheduleOnRN(commit);
          } else {
            translateX.set(
              withSpring(0, {
                damping: 18,
                stiffness: 260,
                mass: 0.7,
              })
            );
          }
        }),
    [
      disabled,
      phase,
      lockedSV,
      dragStartX,
      translateX,
      travelSV,
      triggerHaptic,
      commit,
    ]
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width: measuredWidth } = e.nativeEvent.layout;
    if (measuredWidth > 0 && Math.abs(measuredWidth - containerWidth) > 2) {
      setContainerWidth(measuredWidth);
    }
  };

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.get() }],
  }));

  const fillAnimatedStyle = useAnimatedStyle(() => ({
    width: interpolate(
      translateX.get(),
      [0, travelSV.get()],
      [GRIP + PAD * 2, widthSV.get()],
      Extrapolation.CLAMP
    ),
  }));

  const labelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.get(),
      [0, travelSV.get() * 0.35],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  const handleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }));

  const baseBgColor =
    phase === "done"
      ? resolvedSuccessColor
      : phase === "error"
        ? resolvedDangerColor
        : resolvedIdleTrackColor;

  const isLightHandle =
    resolvedHandleColor.toUpperCase() === "#FFFFFF" ||
    resolvedHandleColor.toUpperCase() === "#FFF";
  const handleIconColor = isLightHandle ? resolvedTrackColor : "#FFFFFF";

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[
        styles.outerContainer,
        containerAnimatedStyle,
        {
          height,
          borderRadius: r,
          backgroundColor: baseBgColor,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
      className={className}
      accessibilityRole="button"
      accessibilityLabel={phase === "done" ? doneLabel : label}
    >
      {/* ACTIVE TRACK FILL */}
      {phase !== "done" && phase !== "error" && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeTrackFill,
            fillAnimatedStyle,
            {
              backgroundColor: resolvedTrackColor,
              borderRadius: r,
            },
          ]}
        />
      )}

      {/* BACKGROUND CENTER LABEL */}
      <View style={styles.labelContainer} pointerEvents="none">
        {phase === "idle" ? (
          <Animated.Text
            style={[
              styles.labelText,
              { color: colors.textSecondary },
              labelAnimatedStyle,
            ]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
        ) : phase === "pending" ? (
          <Text
            style={[styles.labelText, styles.labelActiveText]}
            numberOfLines={1}
          >
            Preparing ride...
          </Text>
        ) : phase === "done" ? (
          <Text
            style={[styles.labelText, styles.labelActiveText]}
            numberOfLines={1}
          >
            {doneLabel}
          </Text>
        ) : (
          <Text
            style={[styles.labelText, styles.labelActiveText]}
            numberOfLines={1}
          >
            {errorLabel}
          </Text>
        )}
      </View>

      {/* DRAGGABLE SLIDE HANDLE */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.handle,
            handleAnimatedStyle,
            {
              width: GRIP,
              height: GRIP,
              borderRadius: gripRadius,
              backgroundColor: resolvedHandleColor,
            },
          ]}
        >
          {phase === "idle" ? (
            (icon ?? (
              <ChevronsRight size={22} color={handleIconColor} strokeWidth={2.6} />
            ))
          ) : phase === "pending" ? (
            <ActivityIndicator size="small" color={handleIconColor} />
          ) : phase === "done" ? (
            <Check size={22} color={handleIconColor} strokeWidth={3} />
          ) : (
            <TriangleAlert size={22} color={handleIconColor} strokeWidth={2.6} />
          )}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: "100%",
    position: "relative",
    justifyContent: "center",
    padding: PAD,
    overflow: "hidden",
  },
  activeTrackFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  labelContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 56,
  },
  labelText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  labelActiveText: {
    color: "#FFFFFF",
  },
  handle: {
    alignItems: "center",
    justifyContent: "center",
  },
});
