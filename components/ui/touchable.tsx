import * as React from "react";
import { Pressable, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/utils";

type TouchableProps = Omit<PressableProps, "children"> & {
  children?: React.ReactNode;
  /** Nilai scale saat ditekan, default 0.96 */
  scaleTo?: number;
};

export function Touchable({
  className,
  children,
  scaleTo = 0.96,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: TouchableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Pressable
      className={cn(className)}
      disabled={disabled}
      onPressIn={(event) => {
        scale.set(withTiming(scaleTo, { duration: 65 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: 110 }));
        onPressOut?.(event);
      }}
      {...props}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
}

/** Varian gaya yang sering dipakai di HyperGrid */
export const touchableStyles = {
  /** Kartu putih dengan border Figma #E2E2E2 */
  card: "rounded-3xl border border-[#E2E2E2] bg-white",
  /** Tombol utama biru solid */
  primary: "rounded-full border-2 border-custom-primary bg-custom-primary",
  /** Tombol outline biru */
  outline: "rounded-3xl border-2 border-custom-primary bg-white",
} as const;

export { cn };
