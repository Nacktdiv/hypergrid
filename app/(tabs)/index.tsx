import React, { useCallback, useMemo, useState } from "react";
import {
  Animated,
  PanResponder,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Navigation,
  RefreshCw,
  User,
} from "lucide-react-native";

import { MainMap } from "@/components/main/main-map";
import { PlayButton } from "@/components/main/play-button";
import { VehicleSelector } from "@/components/main/vehicle-selector";
import { AppButton } from "@/components/ui/app-button";
import { TopFloatingHeader } from "@/components/ui/top-floating-header";
import { Touchable } from "@/components/ui/touchable";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";
import { useUserLocation } from "@/hooks/use-user-location";
import { useVehicle } from "@/contexts/vehicle-context";
import { TOKENS } from "@/lib/theme/tokens";

const PEEK_HEIGHT = 48;

export default function StartScreen() {
  const router = useRouter();
  const { vehicleId, setVehicle } = useVehicle();
  const { fetchClusters } = usePotholeClusters();
  const { coords: liveCoords, getImmediateLocation } = useUserLocation();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(330);

  // Animated translateY for the bottom drawer
  const [drawerY] = useState(() => new Animated.Value(0));

  const maxCollapse = Math.max(0, drawerHeight - PEEK_HEIGHT);

  const snapTo = useCallback(
    (toValue: number, collapseState: boolean) => {
      setIsCollapsed(collapseState);
      Animated.spring(drawerY, {
        toValue,
        useNativeDriver: false,
        bounciness: 2,
        speed: 15,
      }).start();
    },
    [drawerY]
  );

  const toggleDrawer = useCallback(() => {
    if (isCollapsed) {
      snapTo(0, false);
    } else {
      snapTo(maxCollapse, true);
    }
  }, [isCollapsed, maxCollapse, snapTo]);

  // PanResponder to handle smooth 1:1 drag gestures like Google Maps
  const panResponder = useMemo(
    () => {
      let touchStartOffset = 0;
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          drawerY.stopAnimation((value) => {
            touchStartOffset = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const limit = Math.max(0, drawerHeight - PEEK_HEIGHT);
          const nextY = Math.min(
            Math.max(0, touchStartOffset + gestureState.dy),
            limit
          );
          drawerY.setValue(nextY);
        },
        onPanResponderRelease: (_, gestureState) => {
          const limit = Math.max(0, drawerHeight - PEEK_HEIGHT);
          const currentY = Math.min(
            Math.max(0, touchStartOffset + gestureState.dy),
            limit
          );

          // Fast downward swipe or pulled down past 35% -> collapse completely
          const shouldCollapse =
            gestureState.vy > 0.3 || currentY > limit * 0.35;
          const target = shouldCollapse ? limit : 0;

          setIsCollapsed(shouldCollapse);
          Animated.spring(drawerY, {
            toValue: target,
            useNativeDriver: false,
            bounciness: 2,
            speed: 15,
          }).start();
        },
      });
    },
    [drawerY, drawerHeight]
  );

  const handleDrawerLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 60) {
      setDrawerHeight(height);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([
      fetchClusters({ limit: 500 }, true),
      getImmediateLocation(),
    ]);
    setIsRefreshing(false);
  };

  const recenterBottom = useMemo(
    () =>
      drawerY.interpolate({
        inputRange: [0, Math.max(1, drawerHeight - PEEK_HEIGHT)],
        outputRange: [drawerHeight + 14, PEEK_HEIGHT + 14],
        extrapolate: "clamp",
      }),
    [drawerY, drawerHeight]
  );

  return (
    <View className="flex-1 bg-surface-canvas relative">
      {/* 1. FULL-BLEED INTERACTIVE LEAFLET MAP */}
      <View className="absolute inset-0 w-full h-full">
        <MainMap
          vehicleId={vehicleId}
          fullBleed
          showOverlayControls={false}
          currentCoords={liveCoords}
        />
      </View>

      {/* 2. TOP FLOATING HEADER (AVATAR, LOCATION PILL, REFRESH) */}
      <TopFloatingHeader
        left={
          <Touchable
            onPress={() => router.push("/(tabs)/profile")}
            accessibilityLabel="Open profile"
            accessibilityRole="button"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow-xs">
              <User size={18} color={TOKENS.colors.slate[800]} />
            </View>
          </Touchable>
        }
        center={
          <View className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-xs">
            <View className="h-2 w-2 rounded-full bg-emerald-500" />
            <Navigation size={12} color={TOKENS.colors.brand.DEFAULT} />
            <Text className="font-quicksand-bold text-xs text-slate-800">
              {liveCoords
                ? `GPS: ${liveCoords.latitude.toFixed(4)}, ${liveCoords.longitude.toFixed(4)}`
                : "Acquiring GPS..."}
            </Text>
          </View>
        }
        right={
          <AppButton
            variant="circle"
            size="sm"
            onPress={handleRefresh}
            loading={isRefreshing}
            iconLeft={<RefreshCw size={16} color={TOKENS.colors.slate[700]} />}
            accessibilityLabel="Refresh location and clusters"
          />
        }
      />

      {/* 3. RE-CENTER MAP FLOATING BUTTON (SYNCHRONIZED WITH DRAWER GESTURES) */}
      <Animated.View
        className="absolute right-4 z-10"
        style={{
          bottom: recenterBottom,
        }}
      >
        <AppButton
          variant="circle"
          size="sm"
          onPress={() => getImmediateLocation()}
          iconLeft={
            <MapPin size={18} color={TOKENS.colors.brand.DEFAULT} />
          }
          accessibilityLabel="Center map on my location"
        />
      </Animated.View>

      {/* 4. GOOGLE MAPS STYLE SWIPEABLE BOTTOM DRAWER */}
      <Animated.View
        onLayout={handleDrawerLayout}
        style={{
          transform: [{ translateY: drawerY }],
        }}
        className="absolute inset-x-0 bottom-0 z-20"
      >
        <View className="rounded-t-sheet bg-white border-t border-slate-200/90 px-5 pt-2 pb-6 shadow-sm">
          {/* DRAG HANDLE & DRAWER TOGGLE HEADER */}
          <View
            {...panResponder.panHandlers}
            className="items-center py-1.5"
          >
            <Touchable
              onPress={toggleDrawer}
              accessibilityRole="button"
              accessibilityLabel={
                isCollapsed ? "Expand vehicle drawer" : "Swipe down to collapse drawer"
              }
            >
              <View className="items-center py-0.5 px-4">
                <View className="w-12 h-1.5 bg-slate-300 rounded-full mb-1.5" />
                <View className="flex-row items-center gap-1.5">
                  {isCollapsed ? (
                    <>
                      <ChevronUp size={14} color={TOKENS.colors.brand.DEFAULT} />
                      <Text className="font-quicksand-bold text-[11px] text-brand">
                        Swipe up for vehicle controls
                      </Text>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} color="#64748B" />
                      <Text className="font-quicksand text-[11px] text-slate-600">
                        Swipe down for full map
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </Touchable>
          </View>

          {/* DRAWER CONTENT: VEHICLE SELECTOR & START RIDE */}
          <View className="gap-4 pt-2">
            <VehicleSelector onSelect={setVehicle} selected={vehicleId} />
            <PlayButton />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
