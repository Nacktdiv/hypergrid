import React, { useEffect, useRef } from "react";
import { Animated, View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";
import { AppCard } from "./app-card";

export interface SkeletonProps extends ViewProps {
  className?: string;
  dark?: boolean;
}

/**
 * Komponen dasar Skeleton Pulse yang ringan (Native Driver 60fps).
 */
export function Skeleton({ className, style, dark = false, ...props }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ opacity }, style]}
      className={cn(
        "rounded-xl",
        dark ? "bg-slate-800" : "bg-slate-200/90",
        className
      )}
      {...props}
    />
  );
}

/**
 * Skeleton untuk konten Halaman History (saat pindah halaman atau ganti tanggal).
 */
export function HistoryContentSkeleton() {
  return (
    <View className="gap-5">
      {/* 1. Radial Metrics Card Skeleton */}
      <AppCard variant="default" className="p-5 gap-4">
        <View className="flex-row items-center justify-between">
          <View className="gap-2">
            <Skeleton className="h-5 w-44 rounded-lg" />
            <Skeleton className="h-3.5 w-56 rounded-md" />
          </View>
          <Skeleton className="h-8 w-8 rounded-full" />
        </View>

        <View className="items-center justify-center py-3">
          <Skeleton className="h-44 w-44 rounded-full" />
        </View>

        <View className="flex-row gap-2 rounded-2xl bg-slate-50 border border-slate-200/70 p-3">
          <View className="flex-1 items-center gap-1.5">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-4 w-10 rounded-md" />
            <Skeleton className="h-2.5 w-12 rounded-md" />
          </View>
          <View className="flex-1 items-center gap-1.5">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-4 w-10 rounded-md" />
            <Skeleton className="h-2.5 w-12 rounded-md" />
          </View>
          <View className="flex-1 items-center gap-1.5">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-4 w-10 rounded-md" />
            <Skeleton className="h-2.5 w-12 rounded-md" />
          </View>
        </View>
      </AppCard>

      {/* 2. Route Map Preview Skeleton */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3.5 w-24 rounded-md" />
        </View>
        <Skeleton className="h-56 w-full rounded-2xl border border-slate-200" />
      </View>

      {/* 3. Telemetry Log Entries Skeleton */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-5 w-48 rounded-lg" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </View>

        {[1, 2, 3].map((item) => (
          <AppCard key={item} variant="default" className="p-4 gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <View className="gap-1.5">
                  <Skeleton className="h-4 w-40 rounded-md" />
                  <Skeleton className="h-3 w-28 rounded-md" />
                </View>
              </View>
              <Skeleton className="h-6 w-16 rounded-full" />
            </View>
            <Skeleton className="h-3.5 w-full rounded-md" />
          </AppCard>
        ))}
      </View>
    </View>
  );
}

/**
 * Skeleton untuk Halaman Profile (saat navigasi awal & sinkronisasi sesi).
 */
export function ProfileContentSkeleton() {
  return (
    <View className="gap-5">
      {/* Header Avatar & Name Skeleton */}
      <AppCard variant="default" className="p-5 items-center gap-3">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-5 w-40 rounded-lg" />
        <Skeleton className="h-3.5 w-48 rounded-md" />
      </AppCard>

      {/* Selected Vehicle Card Skeleton */}
      <AppCard variant="default" className="p-5 gap-3.5">
        <View className="flex-row items-center justify-between">
          <View className="gap-2 flex-1 mr-4">
            <Skeleton className="h-3.5 w-28 rounded-md" />
            <Skeleton className="h-6 w-44 rounded-lg" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </View>
          <Skeleton className="h-16 w-24 rounded-xl" />
        </View>
        <View className="flex-row gap-2 pt-1">
          <Skeleton className="flex-1 h-12 rounded-xl" />
          <Skeleton className="flex-1 h-12 rounded-xl" />
        </View>
      </AppCard>

      {/* Personal Info List Skeleton */}
      <AppCard variant="default" className="p-5 gap-4">
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-5 w-36 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </View>
        {[1, 2, 3].map((row) => (
          <View key={row} className="flex-row items-center justify-between py-1">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-4 w-36 rounded-md" />
          </View>
        ))}
      </AppCard>
    </View>
  );
}

/**
 * Skeleton untuk Kanvas Peta (MainMap & LiveMap saat akuisisi GPS / fetch klaster).
 */
export function MapCanvasSkeleton({ dark = false }: { dark?: boolean }) {
  return (
    <View
      className={cn(
        "flex-1 w-full h-full items-center justify-center p-6",
        dark ? "bg-[#0B0F19]" : "bg-slate-100"
      )}
    >
      <View className="w-full max-w-xs items-center gap-3.5 rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-sm">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-40 rounded-lg" />
        <Skeleton className="h-3 w-52 rounded-md" />
        <View className="w-full flex-row gap-2 pt-2">
          <Skeleton className="flex-1 h-8 rounded-xl" />
          <Skeleton className="flex-1 h-8 rounded-xl" />
        </View>
      </View>
    </View>
  );
}
