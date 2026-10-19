import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Check, ChevronsRight, TriangleAlert } from "lucide-react-native";

export type SlideCommitPhase = "idle" | "pending" | "done" | "error";

export interface SlideCommitProps {
  label?: string;
  doneLabel?: string;
  errorLabel?: string;
  onConfirm?: () => void | Promise<unknown>;
  onDone?: () => void;
  onError?: (reason: unknown) => void;
  trackColor?: string;
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
const MIN_PENDING_MS = 350;

export function SlideCommit({
  label = "Slide to start ride",
  doneLabel = "Starting Ride...",
  errorLabel = "Failed to start",
  onConfirm,
  onDone,
  onError,
  trackColor = "#009EFF",
  handleColor = "#FFFFFF",
  successColor = "#10B981",
  dangerColor = "#EF4444",
  height = 56,
  width,
  radius,
  disabled = false,
  icon,
  className = "",
}: SlideCommitProps) {
  const [phase, setPhase] = useState<SlideCommitPhase>("idle");
  const [containerWidth, setContainerWidth] = useState<number>(width || 0);

  const GRIP = height - PAD * 2;
  const r = radius !== undefined ? radius : height / 2;
  const gripRadius = Math.max(0, r - PAD);

  // Animated values
  const [translateX] = useState(() => new Animated.Value(0));
  const [shakeX] = useState(() => new Animated.Value(0));

  const currentTravelRef = useRef(0);
  const isPendingOrDoneRef = useRef(false);
  isPendingOrDoneRef.current = phase === "pending" || phase === "done";

  // Dynamic travel distance based on measured width
  const actualWidth = width || containerWidth;
  const TRAVEL = Math.max(1, actualWidth - PAD * 2 - GRIP);
  currentTravelRef.current = TRAVEL;

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
        // Abaikan pada device/simulator tanpa haptics
      }
    },
    []
  );

  const shakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -3, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeX]);

  const snapHome = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 16,
    }).start();
  }, [translateX]);

  const resetToIdle = useCallback(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    setPhase("idle");
  }, [translateX]);

  const commit = useCallback(async () => {
    const travelDistance = currentTravelRef.current;
    Animated.timing(translateX, {
      toValue: travelDistance,
      duration: 100,
      useNativeDriver: true,
    }).start();

    triggerHaptic("medium");

    let result: void | Promise<unknown>;
    try {
      result = onConfirm?.();
    } catch (err) {
      triggerHaptic("error");
      setPhase("error");
      onError?.(err);
      shakeAnimation();
      setTimeout(() => {
        snapHome();
        setPhase("idle");
      }, 1500);
      return;
    }

    const isPromise = result && typeof (result as any).then === "function";

    if (!isPromise) {
      triggerHaptic("success");
      setPhase("done");
      onDone?.();
      setTimeout(() => {
        resetToIdle();
      }, 300);
      return;
    }

    setPhase("pending");
    const t0 = Date.now();

    try {
      await result;
      const elapsed = Date.now() - t0;
      const delay = Math.max(0, MIN_PENDING_MS - elapsed);
      setTimeout(() => {
        triggerHaptic("success");
        setPhase("done");
        onDone?.();
        setTimeout(() => {
          resetToIdle();
        }, 300);
      }, delay);
    } catch (err) {
      const elapsed = Date.now() - t0;
      const delay = Math.max(0, MIN_PENDING_MS - elapsed);
      setTimeout(() => {
        triggerHaptic("error");
        setPhase("error");
        onError?.(err);
        shakeAnimation();
        setTimeout(() => {
          snapHome();
          setPhase("idle");
        }, 1500);
      }, delay);
    }
  }, [translateX, triggerHaptic, onConfirm, onDone, onError, shakeAnimation, snapHome, resetToIdle]);

  const panResponder = useMemo(() => {
    let touchStartX = 0;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !isPendingOrDoneRef.current,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !disabled && !isPendingOrDoneRef.current && Math.abs(gesture.dx) > 3,
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          touchStartX = value;
        });
        triggerHaptic("light");
      },
      onPanResponderMove: (_, gesture) => {
        const travel = currentTravelRef.current;
        const nextX = Math.min(Math.max(0, touchStartX + gesture.dx), travel);
        translateX.setValue(nextX);
      },
      onPanResponderRelease: (_, gesture) => {
        const travel = currentTravelRef.current;
        const currentX = Math.min(Math.max(0, touchStartX + gesture.dx), travel);

        // Ambang aktivasi: melewati 85% perjalanan atau flick cepat ke kanan
        if (currentX >= travel * 0.85 || gesture.vx > 0.8) {
          commit();
        } else {
          snapHome();
        }
      },
    });
  }, [disabled, translateX, triggerHaptic, commit, snapHome]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width: measuredWidth } = e.nativeEvent.layout;
    if (measuredWidth > 0 && Math.abs(measuredWidth - containerWidth) > 2) {
      setContainerWidth(measuredWidth);
    }
  };

  // Text fade out as handle slides past 40% of the travel track
  const labelOpacity = useMemo(() => {
    return translateX.interpolate({
      inputRange: [0, Math.max(1, TRAVEL * 0.45)],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });
  }, [translateX, TRAVEL]);

  const currentBgColor =
    phase === "done"
      ? successColor
      : phase === "error"
      ? dangerColor
      : trackColor;

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[
        styles.outerContainer,
        {
          height,
          borderRadius: r,
          backgroundColor: currentBgColor,
          transform: [{ translateX: shakeX }],
          opacity: disabled ? 0.55 : 1,
        },
      ]}
      className={className}
      accessibilityRole="button"
      accessibilityLabel={phase === "done" ? doneLabel : label}
    >
      {/* BACKGROUND CENTER LABEL */}
      <View style={styles.labelContainer} pointerEvents="none">
        {phase === "idle" ? (
          <Animated.Text
            style={[styles.labelText, { opacity: labelOpacity }]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
        ) : phase === "pending" ? (
          <Text style={styles.labelText} numberOfLines={1}>
            Preparing ride...
          </Text>
        ) : phase === "done" ? (
          <Text style={styles.labelText} numberOfLines={1}>
            {doneLabel}
          </Text>
        ) : (
          <Text style={styles.labelText} numberOfLines={1}>
            {errorLabel}
          </Text>
        )}
      </View>

      {/* DRAGGABLE SLIDE HANDLE */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.handle,
          {
            width: GRIP,
            height: GRIP,
            borderRadius: gripRadius,
            backgroundColor: handleColor,
            transform: [{ translateX }],
          },
        ]}
      >
        {phase === "idle" ? (
          icon ?? (
            <ChevronsRight
              size={22}
              color={trackColor}
              strokeWidth={2.6}
            />
          )
        ) : phase === "pending" ? (
          <ActivityIndicator size="small" color={trackColor} />
        ) : phase === "done" ? (
          <Check size={22} color={successColor} strokeWidth={3} />
        ) : (
          <TriangleAlert size={22} color={dangerColor} strokeWidth={2.6} />
        )}
      </Animated.View>
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
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  labelContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  labelText: {
    color: "#FFFFFF",
    fontFamily: "Quicksand_700Bold",
    fontSize: 15,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  handle: {
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
