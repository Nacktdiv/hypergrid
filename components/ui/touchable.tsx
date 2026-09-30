import * as React from "react";
import { Animated, Pressable, type PressableProps } from "react-native"

import { cn } from "@/lib/utils";

/**
 * Pressable dengan umpan balik visual (scale) saat disentuh.
 *
 * Memakai `Animated` bawaan React Native — tanpa dependensi tambahan dan
 * tanpa reanimated, sehingga tetap aman di tahap UI-Only.
 *
 * `onPress` biarkan opsional supaya pemanggil bisa mengosongkan aksi
 * (misalnya tombol yang sengaja belum punya navigasi/backend).
 */
type TouchableProps = Omit<PressableProps, "children"> & {
  children?: React.ReactNode
  /** Nilai scale saat ditekan, default 0.96 */
  scaleTo?: number
}

export function Touchable({
  className,
  children,
  scaleTo = 0.96,
  disabled,
  ...props
}: TouchableProps) {
  // `useState` dengan initializer dipakai, bukan `useRef`, agar complies
  // dengan aturan `react-hooks/refs` (nilai Animated tetap stabil seumur
  // hidup komponen).
  const [scale] = React.useState(() => new Animated.Value(1))

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start()
  }

  return (
    <Pressable
      className={cn(className)}
      disabled={disabled}
      onPressIn={() => animateTo(scaleTo)}
      onPressOut={() => animateTo(1)}
      {...props}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  )
}

/** Varian gaya yang sering dipakai di HyperGrid */
export const touchableStyles = {
  /** Kartu putih dengan border Figma #E2E2E2 */
  card: "rounded-3xl border border-[#E2E2E2] bg-white",
  /** Tombol utama biru solid */
  primary: "rounded-full border-2 border-custom-primary bg-custom-primary",
  /** Tombol outline biru */
  outline: "rounded-3xl border-2 border-custom-primary bg-white",
} as const

export { cn }
