import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Compass,
  Navigation,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from "lucide-react-native";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

import {
  MainMap,
  type MainMapFocusTarget,
} from "@/components/main/main-map";
import { PlayButton } from "@/components/main/play-button";
import {
  formatDistanceLabel,
  getPopularDestinationsWithDistance,
  TripPlannerSheet,
} from "@/components/main/trip-planner-sheet";
import { VehicleSelector } from "@/components/main/vehicle-selector";
import type { LatLng } from "@/components/map/map-data";
import { EmergencyModal } from "@/components/ui/emergency-modal";
import { useAuth } from "@/contexts/auth-context";
import { useAppTheme } from "@/contexts/theme-context";
import type { AppThemeColors } from "@/lib/theme/tokens";
import { useVehicle } from "@/contexts/vehicle-context";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";
import { useUserLocation } from "@/hooks/use-user-location";
import {
  routingService,
  type PlannedRoute,
} from "@/services/api/routing.service";

const PEEK_HEIGHT = 44;

type DrawerMode = "browse" | "launch";

export default function StartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { vehicleId, setVehicle } = useVehicle();
  const { clusters, fetchClusters } = usePotholeClusters();
  const { coords: liveCoords, getImmediateLocation } = useUserLocation();

  const [drawerMode, setDrawerMode] = useState<DrawerMode>("browse");
  const [areaTitle, setAreaTitle] = useState("Current Location");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEmergencyVisible, setIsEmergencyVisible] = useState(false);
  const [isTripPlannerVisible, setIsTripPlannerVisible] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [activeRoute, setActiveRoute] = useState<PlannedRoute | null>(null);
  const [drawerHeight, setDrawerHeight] = useState(330);
  const [focusTarget, setFocusTarget] = useState<MainMapFocusTarget | null>(
    null,
  );

  // UI-thread only animation (translateY transform uses useNativeDriver: true)
  const [drawerY] = useState(() => new Animated.Value(0));
  const lastGeocodeCoordsRef = useRef<LatLng | null>(null);
  const liveCoordsRef = useRef<LatLng | null>(liveCoords);

  useEffect(() => {
    liveCoordsRef.current = liveCoords;
  }, [liveCoords]);

  const maxCollapse = Math.max(0, drawerHeight - PEEK_HEIGHT);

  const snapTo = useCallback(
    (toValue: number, collapseState: boolean) => {
      setIsCollapsed(collapseState);
      Animated.spring(drawerY, {
        toValue,
        useNativeDriver: true,
        bounciness: 2,
        speed: 16,
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

  // Reverse geocode current area name only when user moves significantly (> 150m)
  useEffect(() => {
    if (!liveCoords) return;
    const prev = lastGeocodeCoordsRef.current;
    if (prev) {
      const dLat = (liveCoords.latitude - prev.latitude) * 111320;
      const dLon =
        (liveCoords.longitude - prev.longitude) *
        111320 *
        Math.cos((liveCoords.latitude * Math.PI) / 180);
      if (dLat * dLat + dLon * dLon < 150 * 150) {
        return;
      }
    }
    lastGeocodeCoordsRef.current = liveCoords;
    let active = true;
    routingService.reverseGeocode(liveCoords).then((place) => {
      if (!active || !place) return;
      if (!place.startsWith("[")) {
        setAreaTitle(place);
      }
    });
    return () => {
      active = false;
    };
  }, [liveCoords]);

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
        const nextY = Math.min(
          Math.max(0, touchStartOffset + gestureState.dy),
          maxCollapse,
        );
        drawerY.setValue(nextY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentY = Math.min(
          Math.max(0, touchStartOffset + gestureState.dy),
          maxCollapse,
        );
        const shouldCollapse =
          gestureState.vy > 0.3 || currentY > maxCollapse * 0.35;
        const target = shouldCollapse ? maxCollapse : 0;

        setIsCollapsed(shouldCollapse);
        Animated.spring(drawerY, {
          toValue: target,
          useNativeDriver: true,
          bounciness: 2,
          speed: 16,
        }).start();
      },
    });
  }, [drawerY, maxCollapse]);

  const handleDrawerLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 60) {
      setDrawerHeight((prev) => (Math.abs(prev - height) > 1 ? height : prev));
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.allSettled([
      fetchClusters({ limit: 500 }, true),
      getImmediateLocation(),
    ]);
    setIsRefreshing(false);
  }, [fetchClusters, getImmediateLocation]);

  const handleRecenter = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    const target = liveCoordsRef.current || (await getImmediateLocation());
    if (target) {
      setFocusTarget({
        latitude: target.latitude,
        longitude: target.longitude,
        zoom: 16.5,
        ts: Date.now(),
      });
    } else {
      await getImmediateLocation();
    }
  }, [getImmediateLocation]);

  const handleOpenLaunchMode = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setDrawerMode("launch");
    snapTo(0, false);
  }, [snapTo]);

  const handleCancelLaunch = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setActiveRoute(null);
    setDrawerMode("browse");
    snapTo(0, false);
  }, [snapTo]);

  const handleOpenTripPlanner = useCallback(() => {
    setIsTripPlannerVisible(true);
  }, []);

  const handleCloseTripPlanner = useCallback(() => {
    setIsTripPlannerVisible(false);
  }, []);

  const handleOpenEmergency = useCallback(() => {
    setIsEmergencyVisible(true);
  }, []);

  const handleCloseEmergency = useCallback(() => {
    setIsEmergencyVisible(false);
  }, []);

  const handleOpenProfile = useCallback(() => {
    router.navigate("/(tabs)/profile");
  }, [router]);

  const handleSelectDestination = useCallback(
    async (destName: string, destCoords: LatLng) => {
      setIsTripPlannerVisible(false);
      setIsCalculatingRoute(true);
      try {
        const start = liveCoordsRef.current || {
          latitude: -6.2088,
          longitude: 106.8206,
        };
        const route = await routingService.calculateRoute(
          start,
          destCoords,
          destName,
          clusters,
        );
        if (route) {
          setActiveRoute(route);
          setDrawerMode("launch");
          snapTo(0, false);
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
    },
    [clusters, snapTo],
  );

  // Quantize coordinate anchor (~55m grid) so GPS micro-jitter never recomputes destination list
  const anchorLatBucket = liveCoords
    ? Math.round(liveCoords.latitude * 2000)
    : null;
  const anchorLngBucket = liveCoords
    ? Math.round(liveCoords.longitude * 2000)
    : null;
  const popularAnchorCoords = useMemo<LatLng | null>(
    () =>
      anchorLatBucket !== null && anchorLngBucket !== null
        ? { latitude: anchorLatBucket / 2000, longitude: anchorLngBucket / 2000 }
        : null,
    [anchorLatBucket, anchorLngBucket],
  );

  const topThreePopular = useMemo(
    () => getPopularDestinationsWithDistance(popularAnchorCoords).slice(0, 3),
    [popularAnchorCoords],
  );

  // Floating controls ride on UI thread in lockstep with drawerY transform
  const routeCardBottom = drawerHeight + 12;
  const floatingControlsBottom = activeRoute
    ? drawerHeight + 160
    : drawerHeight + 14;

  const hasLiveLocation = liveCoords !== null;
  const userInitial = (user?.name || "U").trim().charAt(0).toUpperCase();

  return (
    <View
      className="flex-1 relative"
      style={{ backgroundColor: colors.canvas }}
    >
      {/* 1. FULL-BLEED INTERACTIVE LEAFLET MAP */}
      <View className="absolute inset-0 w-full h-full">
        <MainMap
          vehicleId={vehicleId}
          fullBleed
          showOverlayControls={false}
          currentCoords={liveCoords}
          plannedRoute={activeRoute?.coordinates}
          focusTarget={focusTarget}
          bottomOffset={activeRoute ? drawerHeight + 168 : drawerHeight + 16}
        />
      </View>

      {/* 2. UNIFIED TOP SEARCH & USER AVATAR CAPSULE PILL */}
      <StartTopBar
        topOffset={Math.max(insets.top, 10) + 6}
        colors={colors}
        isCalculatingRoute={isCalculatingRoute}
        activeRoute={activeRoute}
        userImage={user?.image}
        hasUserName={Boolean(user?.name)}
        userInitial={userInitial}
        onOpenTripPlanner={handleOpenTripPlanner}
        onCancelRoute={handleCancelLaunch}
        onOpenProfile={handleOpenProfile}
      />

      {/* 3. FLOATING MAP CONTROLS (UI-THREAD TRANSFORM) */}
      <StartFloatingControls
        bottom={floatingControlsBottom}
        drawerY={drawerY}
        colors={colors}
        isRefreshing={isRefreshing}
        onOpenEmergency={handleOpenEmergency}
        onRefresh={handleRefresh}
        onRecenter={handleRecenter}
        onOpenTripPlanner={handleOpenTripPlanner}
      />

      {/* 4. FLOATING ROUTE INSIGHT CARD */}
      {activeRoute ? (
        <Animated.View
          className="absolute inset-x-4 z-10"
          style={{
            bottom: routeCardBottom,
            transform: [{ translateY: drawerY }],
          }}
        >
          <View
            className="rounded-2xl border p-3.5 shadow-lg"
            style={{
              backgroundColor: colors.pill,
              borderColor: colors.border,
            }}
          >
            <View
              className="flex-row items-center justify-between pb-2.5 border-b"
              style={{ borderBottomColor: colors.border }}
            >
              <View className="flex-1 pr-2 flex-row items-center gap-1.5">
                <Navigation size={13} color={colors.brand} />
                <Text
                  className="font-inter-bold text-sm flex-1"
                  style={{ color: colors.text }}
                  numberOfLines={1}
                >
                  {activeRoute.destinationName}
                </Text>
              </View>

              <View
                className="px-2.5 py-0.5 rounded-full border flex-row items-center gap-1"
                style={{
                  backgroundColor:
                    activeRoute.hazards.safetyRating === "dangerous"
                      ? colors.dangerSoft
                      : activeRoute.hazards.safetyRating === "caution"
                        ? colors.warningSoft
                        : colors.successSoft,
                  borderColor:
                    activeRoute.hazards.safetyRating === "dangerous"
                      ? colors.danger
                      : activeRoute.hazards.safetyRating === "caution"
                        ? colors.warning
                        : colors.success,
                }}
              >
                {activeRoute.hazards.safetyRating === "dangerous" ? (
                  <AlertTriangle size={11} color={colors.danger} />
                ) : activeRoute.hazards.safetyRating === "caution" ? (
                  <ShieldAlert size={11} color={colors.warning} />
                ) : (
                  <ShieldCheck size={11} color={colors.success} />
                )}
                <Text
                  className="font-inter-bold text-[10px]"
                  style={{
                    color:
                      activeRoute.hazards.safetyRating === "dangerous"
                        ? colors.dangerText
                        : activeRoute.hazards.safetyRating === "caution"
                          ? colors.warningText
                          : colors.successText,
                  }}
                >
                  {activeRoute.hazards.safetyRating === "safe"
                    ? "Clear"
                    : `${activeRoute.hazards.totalHazards} pts`}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between pt-2.5">
              <View className="items-center flex-1">
                <Text
                  className="font-inter text-[10px]"
                  style={{ color: colors.textMuted }}
                >
                  Distance
                </Text>
                <Text
                  className="font-mono-bold text-xs mt-0.5"
                  style={{ color: colors.text }}
                >
                  {(activeRoute.distanceMeters / 1000).toFixed(1)} km
                </Text>
              </View>

              <View
                className="w-[1px] h-6"
                style={{ backgroundColor: colors.border }}
              />

              <View className="items-center flex-1">
                <Text
                  className="font-inter text-[10px]"
                  style={{ color: colors.textMuted }}
                >
                  Est. Time
                </Text>
                <Text
                  className="font-mono-bold text-xs mt-0.5"
                  style={{ color: colors.text }}
                >
                  {Math.max(1, Math.round(activeRoute.durationSeconds / 60))}{" "}
                  min
                </Text>
              </View>

              <View
                className="w-[1px] h-6"
                style={{ backgroundColor: colors.border }}
              />

              <View className="items-center flex-1">
                <Text
                  className="font-inter text-[10px]"
                  style={{ color: colors.textMuted }}
                >
                  Hazards
                </Text>
                <Text
                  className="font-mono-bold text-xs mt-0.5"
                  style={{
                    color:
                      activeRoute.hazards.totalHazards > 0
                        ? colors.warningText
                        : colors.successText,
                  }}
                >
                  {activeRoute.hazards.totalHazards === 0
                    ? "Clear"
                    : `${activeRoute.hazards.totalHazards} pts`}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {/* 5. 2-STATE SWIPEABLE BOTTOM DRAWER */}
      <Animated.View
        onLayout={handleDrawerLayout}
        style={{
          transform: [{ translateY: drawerY }],
        }}
        className="absolute inset-x-0 bottom-0 z-20"
      >
        <View
          className="rounded-t-[28px] border-t px-5 pt-2 pb-5 shadow-lg"
          style={{
            backgroundColor: colors.sheet,
            borderTopColor: colors.border,
          }}
        >
          {/* Drag Handle */}
          <View {...panResponder.panHandlers} className="items-center py-1.5">
            <Pressable
              onPress={toggleDrawer}
              accessibilityRole="button"
              accessibilityLabel={
                isCollapsed
                  ? "Expand bottom drawer"
                  : "Swipe down to collapse bottom drawer"
              }
              className="py-0.5 px-6"
            >
              <View
                className="w-11 h-1.5 rounded-full"
                style={{ backgroundColor: colors.borderStrong }}
              />
            </Pressable>
          </View>

          {drawerMode === "browse" ? (
            /* BROWSE STATE: Current Location + "Ride" pill + Popular Destinations */
            <View className="gap-3.5 pt-1">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text
                    className="font-inter-bold text-lg tracking-tight"
                    style={{ color: colors.text }}
                    numberOfLines={1}
                  >
                    {areaTitle}
                  </Text>
                  <Text
                    className="font-inter text-xs mt-0.5"
                    style={{ color: colors.textMuted }}
                    numberOfLines={1}
                  >
                    {hasLiveLocation
                      ? `${clusters.length} hazards nearby`
                      : "Locating..."}
                  </Text>
                </View>

                <Pressable
                  onPress={handleOpenLaunchMode}
                  accessibilityRole="button"
                  accessibilityLabel="Prepare Ride"
                  className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-full active:opacity-85"
                  style={{ backgroundColor: colors.brand }}
                >
                  <Navigation size={14} color="#FFFFFF" />
                  <Text className="font-inter-bold text-xs text-white">
                    Ride
                  </Text>
                </Pressable>
              </View>

              <View className="flex-row items-center justify-between pt-1">
                <Text
                  className="font-inter-bold text-xs uppercase tracking-wider"
                  style={{ color: colors.textMuted }}
                >
                  Popular Destinations
                </Text>
                <Pressable
                  onPress={handleOpenTripPlanner}
                  className="flex-row items-center gap-1"
                >
                  <Clock size={12} color={colors.brand} />
                  <Text
                    className="font-inter-semibold text-xs"
                    style={{ color: colors.brandText }}
                  >
                    Quick
                  </Text>
                </Pressable>
              </View>

              <View className="gap-2">
                {topThreePopular.map((dest) => {
                  const IconComp = dest.icon;
                  return (
                    <Pressable
                      key={dest.name}
                      onPress={() =>
                        handleSelectDestination(dest.name, dest.coords)
                      }
                      className="flex-row items-center justify-between rounded-2xl border px-3.5 py-2.5 active:opacity-80"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Navigate to ${dest.name}`}
                    >
                      <View className="flex-row items-center gap-3 flex-1 pr-2">
                        <View
                          className="h-9 w-9 rounded-xl items-center justify-center"
                          style={{ backgroundColor: colors.subtle }}
                        >
                          <IconComp size={16} color={colors.brand} />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="font-inter-bold text-[13px]"
                            style={{ color: colors.text }}
                            numberOfLines={1}
                          >
                            {dest.name}
                          </Text>
                          <Text
                            className="font-inter text-[11px] mt-0.5"
                            style={{ color: colors.textMuted }}
                            numberOfLines={1}
                          >
                            {dest.category} ·{" "}
                            {formatDistanceLabel(dest.distanceMeters)}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight size={15} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            /* LAUNCH STATE: Free Ride / Destination + Cancel + Vehicle Selector + SlideCommit */
            <View className="gap-4 pt-1">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text
                    className="font-inter-bold text-lg tracking-tight"
                    style={{ color: colors.text }}
                    numberOfLines={1}
                  >
                    {activeRoute ? activeRoute.destinationName : "Free Ride"}
                  </Text>
                  <Text
                    className="font-inter text-xs mt-0.5"
                    style={{ color: colors.textMuted }}
                    numberOfLines={1}
                  >
                    {activeRoute
                      ? `${(activeRoute.distanceMeters / 1000).toFixed(1)} km · ${Math.max(1, Math.round(activeRoute.durationSeconds / 60))} min`
                      : "Road hazard scan"}
                  </Text>
                </View>

                <Pressable
                  onPress={handleCancelLaunch}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel ride setup"
                  className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: colors.subtle,
                    borderColor: colors.border,
                  }}
                >
                  <X size={13} color={colors.textSecondary} />
                  <Text
                    className="font-inter-semibold text-xs"
                    style={{ color: colors.textSecondary }}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>

              <VehicleSelector onSelect={setVehicle} selected={vehicleId} />
              <PlayButton activeRoute={activeRoute} />
            </View>
          )}
        </View>
      </Animated.View>

      {/* TRIP PLANNER DESTINATION MODAL */}
      <TripPlannerSheet
        visible={isTripPlannerVisible}
        onClose={handleCloseTripPlanner}
        userCoords={isTripPlannerVisible ? liveCoords : null}
        onSelectDestination={handleSelectDestination}
      />

      {/* EMERGENCY SOS MODAL */}
      <EmergencyModal
        visible={isEmergencyVisible}
        onClose={handleCloseEmergency}
        currentCoords={isEmergencyVisible ? liveCoords : null}
      />
    </View>
  );
}

const StartTopBar = memo(function StartTopBar({
  topOffset,
  colors,
  isCalculatingRoute,
  activeRoute,
  userImage,
  hasUserName,
  userInitial,
  onOpenTripPlanner,
  onCancelRoute,
  onOpenProfile,
}: {
  topOffset: number;
  colors: AppThemeColors;
  isCalculatingRoute: boolean;
  activeRoute: PlannedRoute | null;
  userImage?: string | null;
  hasUserName: boolean;
  userInitial: string;
  onOpenTripPlanner: () => void;
  onCancelRoute: () => void;
  onOpenProfile: () => void;
}) {
  return (
    <View className="absolute inset-x-4 z-20" style={{ top: topOffset }}>
      <View
        className="flex-row items-center h-13 pl-2 pr-1.5 rounded-full border shadow-md"
        style={{
          backgroundColor: colors.pill,
          borderColor: colors.border,
        }}
      >
        <Pressable
          onPress={onOpenTripPlanner}
          accessibilityRole="button"
          accessibilityLabel="Search destination"
          className="flex-1 flex-row items-center gap-2.5 h-full py-1.5 active:opacity-80"
        >
          <View
            className="h-9 w-9 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.brandSoft }}
          >
            {isCalculatingRoute ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Search size={17} color={colors.brand} />
            )}
          </View>

          <View className="flex-1">
            {isCalculatingRoute ? (
              <Text
                className="font-inter-semibold text-[13px]"
                style={{ color: colors.brandText }}
                numberOfLines={1}
              >
                Finding route...
              </Text>
            ) : activeRoute ? (
              <View className="flex-row items-center gap-1.5">
                <Navigation size={13} color={colors.brand} />
                <Text
                  className="font-inter-semibold text-[13px] flex-1"
                  style={{ color: colors.text }}
                  numberOfLines={1}
                >
                  {activeRoute.destinationName} ·{" "}
                  {(activeRoute.distanceMeters / 1000).toFixed(1)} km
                </Text>
              </View>
            ) : (
              <Text
                className="font-inter-medium text-[14px]"
                style={{ color: colors.textMuted }}
                numberOfLines={1}
              >
                Search destination...
              </Text>
            )}
          </View>
        </Pressable>

        {activeRoute && !isCalculatingRoute ? (
          <Pressable
            onPress={onCancelRoute}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="h-8 w-8 rounded-full items-center justify-center mr-1.5"
            style={{ backgroundColor: colors.subtle }}
            accessibilityRole="button"
            accessibilityLabel="Clear active route"
          >
            <X size={14} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={onOpenProfile}
          accessibilityLabel="Open user profile"
          accessibilityRole="button"
          className="h-9 w-9 rounded-full items-center justify-center border-2 overflow-hidden"
          style={{
            backgroundColor: colors.brandSoft,
            borderColor: colors.brand,
          }}
        >
          {userImage ? (
            <Image
              source={{ uri: userImage }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : hasUserName ? (
            <Text
              className="font-inter-bold text-xs"
              style={{ color: colors.brandText }}
            >
              {userInitial}
            </Text>
          ) : (
            <User size={16} color={colors.brand} />
          )}
        </Pressable>
      </View>
    </View>
  );
});

const StartFloatingControls = memo(function StartFloatingControls({
  bottom,
  drawerY,
  colors,
  isRefreshing,
  onOpenEmergency,
  onRefresh,
  onRecenter,
  onOpenTripPlanner,
}: {
  bottom: number;
  drawerY: Animated.Value;
  colors: AppThemeColors;
  isRefreshing: boolean;
  onOpenEmergency: () => void;
  onRefresh: () => void;
  onRecenter: () => void;
  onOpenTripPlanner: () => void;
}) {
  return (
    <Animated.View
      className="absolute right-4 z-10 items-end gap-2.5"
      style={{
        bottom,
        transform: [{ translateY: drawerY }],
      }}
    >
      <Pressable
        onPress={onOpenEmergency}
        accessibilityRole="button"
        accessibilityLabel="Open Emergency Assistance Center"
        className="h-11 w-11 rounded-full bg-rose-600 border border-rose-700 items-center justify-center shadow-md active:bg-rose-700"
      >
        <View className="items-center justify-center">
          <AlertTriangle size={14} color="#FFFFFF" strokeWidth={2.5} />
          <Text className="font-inter-extrabold text-[8px] text-white tracking-wider mt-0.5">
            SOS
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onRefresh}
        accessibilityRole="button"
        accessibilityLabel="Refresh map and pothole data"
        className="h-11 w-11 rounded-full border items-center justify-center shadow-sm active:opacity-80"
        style={{
          backgroundColor: colors.pill,
          borderColor: colors.border,
        }}
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : (
          <RefreshCw size={17} color={colors.textSecondary} />
        )}
      </Pressable>

      <Pressable
        onPress={onRecenter}
        accessibilityRole="button"
        accessibilityLabel="Center map on my location"
        className="h-11 w-11 rounded-full border items-center justify-center shadow-sm active:opacity-80"
        style={{
          backgroundColor: colors.pill,
          borderColor: colors.border,
        }}
      >
        <Compass size={19} color={colors.text} />
      </Pressable>

      <Pressable
        onPress={onOpenTripPlanner}
        accessibilityRole="button"
        accessibilityLabel="Plan driving route"
        className="h-11 w-11 rounded-full items-center justify-center shadow-md active:opacity-90"
        style={{ backgroundColor: colors.brand }}
      >
        <Navigation size={18} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
});
