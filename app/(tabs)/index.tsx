import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ChevronUp,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MainMap } from "@/components/main/main-map";
import { PlayButton } from "@/components/main/play-button";
import { TripPlannerSheet } from "@/components/main/trip-planner-sheet";
import { VehicleSelector } from "@/components/main/vehicle-selector";
import type { LatLng } from "@/components/map/map-data";
import { AppButton } from "@/components/ui/app-button";
import { EmergencyModal } from "@/components/ui/emergency-modal";
import { useVehicle } from "@/contexts/vehicle-context";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";
import { useUserLocation } from "@/hooks/use-user-location";
import { TOKENS } from "@/lib/theme/tokens";
import {
  routingService,
  type PlannedRoute,
} from "@/services/api/routing.service";

const PEEK_HEIGHT = 48;

export default function StartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vehicleId, setVehicle } = useVehicle();
  const { clusters, fetchClusters } = usePotholeClusters();
  const { coords: liveCoords, getImmediateLocation } = useUserLocation();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEmergencyVisible, setIsEmergencyVisible] = useState(false);
  const [isTripPlannerVisible, setIsTripPlannerVisible] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [activeRoute, setActiveRoute] = useState<PlannedRoute | null>(null);
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
    [drawerY],
  );

  const toggleDrawer = useCallback(() => {
    if (isCollapsed) {
      snapTo(0, false);
    } else {
      snapTo(maxCollapse, true);
    }
  }, [isCollapsed, maxCollapse, snapTo]);

  // PanResponder to handle smooth 1:1 drag gestures like Google Maps
  const panResponder = useMemo(() => {
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
          limit,
        );
        drawerY.setValue(nextY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const limit = Math.max(0, drawerHeight - PEEK_HEIGHT);
        const currentY = Math.min(
          Math.max(0, touchStartOffset + gestureState.dy),
          limit,
        );

        // Fast downward swipe or pulled down past 35% -> collapse completely
        const shouldCollapse = gestureState.vy > 0.3 || currentY > limit * 0.35;
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
  }, [drawerY, drawerHeight]);

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

  // Direct route calculation on map without leaving screen ("gak pindah halaman")
  const handleSelectDestination = async (
    destName: string,
    destCoords: LatLng,
  ) => {
    setIsTripPlannerVisible(false);
    setIsCalculatingRoute(true);
    try {
      const start = liveCoords || { latitude: -6.2088, longitude: 106.8206 };
      const route = await routingService.calculateRoute(
        start,
        destCoords,
        destName,
        clusters,
      );
      if (route) {
        setActiveRoute(route);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      } else {
        Alert.alert(
          "Route Not Found",
          "Could not calculate driving directions to this location. Please try another destination.",
        );
      }
    } catch (err) {
      console.warn("[StartScreen] Route calculation error:", err);
      Alert.alert(
        "Route Error",
        "Failed to calculate route. Please try again.",
      );
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const recenterBottom = useMemo(
    () =>
      drawerY.interpolate({
        inputRange: [0, Math.max(1, drawerHeight - PEEK_HEIGHT)],
        outputRange: [drawerHeight + 14, PEEK_HEIGHT + 14],
        extrapolate: "clamp",
      }),
    [drawerY, drawerHeight],
  );

  // Offset right floating buttons if the route insight card is currently displayed
  const floatingControlsBottom = useMemo(
    () => (activeRoute ? Animated.add(recenterBottom, 152) : recenterBottom),
    [activeRoute, recenterBottom],
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
          plannedRoute={activeRoute?.coordinates}
        />
      </View>

      {/* 2. UNIFIED TOP NAVIGATION & SEARCH BAR */}
      <View
        className="absolute inset-x-4 z-20 flex-row items-center gap-2.5"
        style={{ top: Math.max(insets.top, 12) + 6 }}
      >
        {/* Profile Avatar Button */}
        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          accessibilityLabel="Open user profile"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-full bg-white border border-slate-200 shadow-xs active:bg-slate-100"
        >
          <User size={18} color={TOKENS.colors.slate[800]} />
        </Pressable>

        {/* Integrated Trip Planner & Search Capsule */}
        <View className="flex-1 flex-row items-center h-11 px-3.5 rounded-full bg-white border border-slate-200 shadow-xs">
          <Pressable
            onPress={() => setIsTripPlannerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Plan route and scan road hazards"
            className="flex-1 flex-row items-center h-full active:opacity-75"
          >
            {isCalculatingRoute ? (
              <View className="flex-row items-center gap-2 flex-1">
                <ActivityIndicator size="small" color="#0040FF" />
                <Text
                  className="font-quicksand-bold text-xs text-sky-600 flex-1"
                  numberOfLines={1}
                >
                  Calculating optimal eco route...
                </Text>
              </View>
            ) : activeRoute ? (
              <View className="flex-row items-center gap-2 flex-1 pr-1.5">
                <Navigation size={13} color="#0040FF" />
                <Text
                  className="font-quicksand-bold text-xs text-slate-800 flex-1"
                  numberOfLines={1}
                >
                  {activeRoute.destinationName} •{" "}
                  {(activeRoute.distanceMeters / 1000).toFixed(1)} km
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-2 flex-1">
                <Search size={16} color="#64748B" />
                <Text
                  className="font-quicksand-semibold text-xs text-slate-400 flex-1"
                  numberOfLines={1}
                >
                  Where to? Search destination...
                </Text>
              </View>
            )}
          </Pressable>

          {activeRoute && !isCalculatingRoute ? (
            <Pressable
              onPress={() => setActiveRoute(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="h-5 w-5 rounded-full items-center justify-center bg-slate-100 active:bg-slate-200 ml-1.5"
              accessibilityRole="button"
              accessibilityLabel="Clear active route"
            >
              <X size={12} color="#64748B" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 3. FLOATING MAP CONTROLS: UNIFORM SOS EMERGENCY, RELOAD, & RE-CENTER */}
      <Animated.View
        className="absolute right-4 z-10 items-end gap-2.5"
        style={{
          bottom: floatingControlsBottom,
        }}
      >
        {/* Uniform Circular SOS Emergency Floating Button */}
        <Pressable
          onPress={() => setIsEmergencyVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Open Emergency Assistance Center"
          className="h-12 w-12 rounded-full bg-rose-600 border border-rose-700 items-center justify-center shadow-md active:bg-rose-700"
        >
          <View className="items-center justify-center">
            <AlertTriangle size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text className="font-chivo-bold text-[9px] text-white tracking-wider mt-0.5">
              SOS
            </Text>
          </View>
        </Pressable>

        {/* Refresh Map & Potholes Button */}
        <AppButton
          variant="circle"
          size="sm"
          onPress={handleRefresh}
          loading={isRefreshing}
          iconLeft={<RefreshCw size={16} color={TOKENS.colors.slate[700]} />}
          accessibilityLabel="Refresh map and pothole data"
        />

        {/* Center Map on User Location */}
        <AppButton
          variant="circle"
          size="sm"
          onPress={() => getImmediateLocation()}
          iconLeft={<MapPin size={18} color={TOKENS.colors.brand.DEFAULT} />}
          accessibilityLabel="Center map on my location"
        />
      </Animated.View>

      {/* 4. FLOATING ROUTE INSIGHT CARD (DIRECT ON MAP, NO PAGE SWITCH) */}
      {activeRoute ? (
        <Animated.View
          className="absolute inset-x-4 z-10"
          style={{
            bottom: recenterBottom,
          }}
        >
          <View className="rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-lg">
            {/* Top row: Destination name & Safety/Eco badge */}
            <View className="flex-row items-center justify-between pb-2.5 border-b border-slate-100">
              <View className="flex-1 pr-2">
                <View className="flex-row items-center gap-1.5">
                  <Navigation size={13} color="#0040FF" />
                  <Text
                    className="font-chivo-bold text-sm text-slate-900"
                    numberOfLines={1}
                  >
                    {activeRoute.destinationName}
                  </Text>
                </View>
              </View>

              <View
                className={`px-2.5 py-0.5 rounded-full border flex-row items-center gap-1 ${
                  activeRoute.hazards.safetyRating === "dangerous"
                    ? "bg-rose-50 border-rose-200"
                    : activeRoute.hazards.safetyRating === "caution"
                      ? "bg-amber-50 border-amber-200"
                      : "bg-emerald-50 border-emerald-200"
                }`}
              >
                {activeRoute.hazards.safetyRating === "dangerous" ? (
                  <AlertTriangle size={11} color="#E11D48" />
                ) : activeRoute.hazards.safetyRating === "caution" ? (
                  <ShieldAlert size={11} color="#D97706" />
                ) : (
                  <ShieldCheck size={11} color="#059669" />
                )}
                <Text
                  className={`font-quicksand-bold text-[10px] ${
                    activeRoute.hazards.safetyRating === "dangerous"
                      ? "text-rose-700"
                      : activeRoute.hazards.safetyRating === "caution"
                        ? "text-amber-700"
                        : "text-emerald-700"
                  }`}
                >
                  {activeRoute.hazards.safetyRating === "safe"
                    ? "Eco & Smooth Route"
                    : `${activeRoute.hazards.totalHazards} Potholes Alert`}
                </Text>
              </View>
            </View>

            {/* Metrics Row: 3 columns (Distance, Duration, Hazards) */}
            <View className="flex-row items-center justify-between pt-2.5 pb-2">
              <View className="items-center flex-1">
                <Text className="font-quicksand text-[10px] text-slate-400">
                  Distance
                </Text>
                <Text className="font-mono-bold text-xs text-slate-800 mt-0.5">
                  {(activeRoute.distanceMeters / 1000).toFixed(1)} km
                </Text>
              </View>

              <View className="w-[1px] h-6 bg-slate-100" />

              <View className="items-center flex-1">
                <Text className="font-quicksand text-[10px] text-slate-400">
                  Est. Time
                </Text>
                <Text className="font-mono-bold text-xs text-slate-800 mt-0.5">
                  {Math.max(1, Math.round(activeRoute.durationSeconds / 60))}{" "}
                  min
                </Text>
              </View>

              <View className="w-[1px] h-6 bg-slate-100" />

              <View className="items-center flex-1">
                <Text className="font-quicksand text-[10px] text-slate-400">
                  Hazards
                </Text>
                <Text
                  className={`font-mono-bold text-xs mt-0.5 ${
                    activeRoute.hazards.totalHazards > 0
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
                >
                  {activeRoute.hazards.totalHazards === 0
                    ? "Clear"
                    : `${activeRoute.hazards.totalHazards} pts`}
                </Text>
              </View>
            </View>

            {/* Footer Action: Cancel Route & Slide Prompt */}
            <View className="flex-row items-center justify-between pt-2 border-t border-slate-100">
              <Text className="font-quicksand text-[11px] text-slate-400">
                Slide below to start
              </Text>

              <Pressable
                onPress={() => setActiveRoute(null)}
                className="h-8 px-3.5 rounded-lg border border-slate-200 bg-slate-50 items-center justify-center active:bg-slate-100"
                accessibilityRole="button"
                accessibilityLabel="Cancel route"
              >
                <Text className="font-quicksand-bold text-xs text-slate-600">
                  Cancel Route
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {/* 5. GOOGLE MAPS STYLE SWIPEABLE BOTTOM DRAWER */}
      <Animated.View
        onLayout={handleDrawerLayout}
        style={{
          transform: [{ translateY: drawerY }],
        }}
        className="absolute inset-x-0 bottom-0 z-20"
      >
        <View className="rounded-t-sheet bg-white border-t border-slate-200/90 px-5 pt-2 pb-6 shadow-sm">
          {/* DRAG HANDLE & DRAWER TOGGLE HEADER */}
          <View {...panResponder.panHandlers} className="items-center py-1.5">
            <Pressable
              onPress={toggleDrawer}
              accessibilityRole="button"
              accessibilityLabel={
                isCollapsed
                  ? "Expand vehicle drawer"
                  : "Swipe down to collapse drawer"
              }
              className="active:opacity-80"
            >
              <View className="items-center py-0.5 px-4">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full mb-1.5" />
                <View className="flex-row items-center gap-1.5">
                  {/* {isCollapsed ? (
                    <>
                      <ChevronUp
                        size={14}
                        color={TOKENS.colors.brand.DEFAULT}
                      />
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
                  )} */}
                </View>
              </View>
            </Pressable>
          </View>

          {/* DRAWER CONTENT: VEHICLE SELECTOR & START RIDE */}
          <View className="gap-4 pt-6">
            <VehicleSelector onSelect={setVehicle} selected={vehicleId} />
            <PlayButton activeRoute={activeRoute} />
          </View>
        </View>
      </Animated.View>

      {/* MODAL PERENCANAAN RUTE NAVIGASI (DESTINATION PICKER) */}
      <TripPlannerSheet
        visible={isTripPlannerVisible}
        onClose={() => setIsTripPlannerVisible(false)}
        userCoords={liveCoords}
        onSelectDestination={handleSelectDestination}
      />

      {/* MODAL PUSAT BANTUAN DARURAT (HOTLINE & SHARE LIVE LOCATION) */}
      <EmergencyModal
        visible={isEmergencyVisible}
        onClose={() => setIsEmergencyVisible(false)}
        currentCoords={liveCoords}
      />
    </View>
  );
}
