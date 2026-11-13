import * as Haptics from "expo-haptics";
import {
  ArrowRight,
  Building2,
  Compass,
  Landmark,
  MapPin,
  Search,
  Train,
  Trophy,
  X,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LatLng } from "@/components/map/map-data";
import { useOptionalTheme } from "@/contexts/theme-context";
import {
  routingService,
  type SearchLocationResult,
} from "@/services/api/routing.service";

export interface TripPlannerSheetProps {
  visible: boolean;
  onClose: () => void;
  userCoords?: LatLng | null;
  onSelectDestination: (destName: string, destCoords: LatLng) => void;
}

export interface PopularPlace {
  name: string;
  address: string;
  category: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  coords: LatLng;
}

export interface PopularPlaceWithDistance extends PopularPlace {
  distanceMeters: number;
}

function calculateHaversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const hav =
    sinLat * sinLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinLon *
      sinLon;
  return R * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

export function formatDistanceLabel(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export const POPULAR_DESTINATIONS: PopularPlace[] = [
  {
    name: "Bundaran HI",
    address: "Menteng, Central Jakarta",
    category: "City Center",
    icon: Landmark,
    coords: { latitude: -6.1951, longitude: 106.8232 },
  },
  {
    name: "Sudirman Station",
    address: "Jl. Kendal, Menteng, Central Jakarta",
    category: "Transit Station",
    icon: Train,
    coords: { latitude: -6.2023, longitude: 106.8236 },
  },
  {
    name: "SCBD Lot 8",
    address: "Kebayoran Baru, South Jakarta",
    category: "Business Hub",
    icon: Building2,
    coords: { latitude: -6.2255, longitude: 106.8097 },
  },
  {
    name: "National Monument (Monas)",
    address: "Gambir, Central Jakarta",
    category: "Landmark",
    icon: Landmark,
    coords: { latitude: -6.1754, longitude: 106.8272 },
  },
  {
    name: "Blok M Hub",
    address: "Kebayoran Baru, South Jakarta",
    category: "Transit Hub",
    icon: Train,
    coords: { latitude: -6.2443, longitude: 106.8 },
  },
  {
    name: "Gelora Bung Karno (GBK)",
    address: "Senayan, Central Jakarta",
    category: "Sports Arena",
    icon: Trophy,
    coords: { latitude: -6.2185, longitude: 106.8026 },
  },
  {
    name: "Kemang Village",
    address: "Bangka, South Jakarta",
    category: "Shopping & Dining",
    icon: Building2,
    coords: { latitude: -6.2605, longitude: 106.8155 },
  },
  {
    name: "Senayan City",
    address: "Jl. Asia Afrika, Central Jakarta",
    category: "Shopping Mall",
    icon: Building2,
    coords: { latitude: -6.2272, longitude: 106.7974 },
  },
];

const DEFAULT_ORIGIN: LatLng = { latitude: -6.2088, longitude: 106.8206 };

export function getPopularDestinationsWithDistance(
  origin?: LatLng | null,
): PopularPlaceWithDistance[] {
  const ref = origin || DEFAULT_ORIGIN;
  return POPULAR_DESTINATIONS.map((dest) => ({
    ...dest,
    distanceMeters: calculateHaversineMeters(ref, dest.coords),
  })).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function TripPlannerSheet({
  visible,
  onClose,
  userCoords,
  onSelectDestination,
}: TripPlannerSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useOptionalTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchLocationResult[]>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced geocoding search using OpenStreetMap Nominatim
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      searchTimeoutRef.current = setTimeout(() => {
        setSearchResults([]);
        setIsSearching(false);
      }, 0);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await routingService.searchLocation(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.warn("[TripPlannerSheet] Error search:", err);
      } finally {
        setIsSearching(false);
      }
    }, 380);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelect = useCallback(
    (name: string, coords: LatLng) => {
      Keyboard.dismiss();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onClose();
      onSelectDestination(name, coords);
    },
    [onClose, onSelectDestination],
  );

  const nearbyPopularDestinations = useMemo(
    () => getPopularDestinationsWithDistance(userCoords),
    [userCoords],
  );

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: colors.overlay }}
      >
        <Pressable
          onPress={onClose}
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Close trip planner"
        />

        <View
          className="max-h-[82%] rounded-t-[30px] border-t px-5 pt-3 shadow-2xl"
          style={{
            backgroundColor: colors.sheet,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          }}
        >
          {/* Subtle Drag Handle */}
          <View
            className="w-10 h-1 rounded-full self-center mb-3"
            style={{ backgroundColor: colors.borderStrong }}
          />

          {/* Modal Header */}
          <View
            className="flex-row items-center justify-between pb-3 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <View className="flex-row items-center gap-3">
              <View
                className="h-9 w-9 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: colors.brandSoft,
                  borderColor: colors.brandBorder,
                }}
              >
                <Compass size={18} color={colors.brand} />
              </View>
              <View>
                <Text
                  className="font-inter-bold text-base leading-tight"
                  style={{ color: colors.text }}
                >
                  Trip Planner
                </Text>
                <Text
                  className="font-inter text-[11px] mt-0.5"
                  style={{ color: colors.textMuted }}
                >
                  Eco route & road safety scanning
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full border"
              style={{
                backgroundColor: colors.subtle,
                borderColor: colors.border,
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={15} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="pt-3 pb-2 gap-3.5"
          >
            {/* 1. WAYPOINT JOURNEY CARD */}
            <View
              className="rounded-2xl border p-3.5"
              style={{
                backgroundColor: colors.cardMuted,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-stretch">
                {/* Visual Waypoint Connectors */}
                <View className="items-center justify-between py-2 pr-3">
                  <View
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colors.brand }}
                  />
                  <View
                    className="w-0.5 flex-1 my-1"
                    style={{ backgroundColor: colors.borderStrong }}
                  />
                  <View className="h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500">
                    <MapPin size={8} color="#FFFFFF" />
                  </View>
                </View>

                {/* Form Fields */}
                <View className="flex-1 gap-2">
                  <View className="py-0.5">
                    <Text
                      className="font-inter-bold text-[10px] uppercase tracking-wider"
                      style={{ color: colors.textMuted }}
                    >
                      Departure
                    </Text>
                    <Text
                      className="font-inter-bold text-xs mt-0.5"
                      style={{ color: colors.text }}
                      numberOfLines={1}
                    >
                      Current GPS Location
                    </Text>
                  </View>

                  <View
                    className="h-[1px]"
                    style={{ backgroundColor: colors.border }}
                  />

                  <View>
                    <Text
                      className="font-inter-bold text-[10px] uppercase tracking-wider mb-1"
                      style={{ color: colors.textMuted }}
                    >
                      Destination
                    </Text>
                    <View
                      className="flex-row items-center px-3 py-2 rounded-xl border"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }}
                    >
                      <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search destination or address..."
                        placeholderTextColor={colors.textMuted}
                        className="flex-1 font-inter-semibold text-xs py-0.5"
                        style={{ color: colors.text }}
                        autoCorrect={false}
                        returnKeyType="search"
                      />
                      {isSearching ? (
                        <ActivityIndicator size="small" color={colors.brand} />
                      ) : searchQuery.length > 0 ? (
                        <Pressable
                          onPress={() => setSearchQuery("")}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          className="h-5 w-5 rounded-full items-center justify-center"
                          style={{ backgroundColor: colors.subtle }}
                          accessibilityLabel="Clear query"
                        >
                          <X size={12} color={colors.textMuted} />
                        </Pressable>
                      ) : (
                        <Search size={15} color={colors.textMuted} />
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* 2. LIVE SEARCH RESULTS */}
            {searchResults.length > 0 ? (
              <View
                className="rounded-2xl border overflow-hidden"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <View
                  className="px-3.5 pt-2.5 pb-1.5 border-b flex-row items-center justify-between"
                  style={{ borderBottomColor: colors.border }}
                >
                  <Text
                    className="font-inter-bold text-[11px] uppercase tracking-wider"
                    style={{ color: colors.textMuted }}
                  >
                    Search Results
                  </Text>
                  <Text
                    className="font-inter text-[10px]"
                    style={{ color: colors.textMuted }}
                  >
                    {searchResults.length} places
                  </Text>
                </View>

                {searchResults.map((res) => (
                  <Pressable
                    key={res.id}
                    onPress={() =>
                      handleSelect(res.name, {
                        latitude: res.latitude,
                        longitude: res.longitude,
                      })
                    }
                    className="flex-row items-center justify-between p-3 border-b last:border-b-0"
                    style={{ borderBottomColor: colors.border }}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose destination ${res.name}`}
                  >
                    <View className="flex-1 pr-2">
                      <Text
                        className="font-inter-bold text-xs"
                        style={{ color: colors.text }}
                        numberOfLines={1}
                      >
                        {res.name}
                      </Text>
                      <Text
                        className="font-inter text-[11px] mt-0.5"
                        style={{ color: colors.textMuted }}
                        numberOfLines={1}
                      >
                        {res.address}
                      </Text>
                    </View>
                    <ArrowRight size={14} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* 3. NEARBY POPULAR DESTINATIONS */}
            {searchResults.length === 0 ? (
              <View className="gap-2">
                <View className="flex-row items-center justify-between px-1">
                  <Text
                    className="font-inter-bold text-[11px] uppercase tracking-wider"
                    style={{ color: colors.textMuted }}
                  >
                    Popular Destinations
                  </Text>
                  <Text
                    className="font-inter text-[10px]"
                    style={{ color: colors.textMuted }}
                  >
                    Sorted by nearest
                  </Text>
                </View>

                <View className="gap-2">
                  {nearbyPopularDestinations.map((dest) => {
                    const IconComp = dest.icon;
                    return (
                      <Pressable
                        key={dest.name}
                        onPress={() => handleSelect(dest.name, dest.coords)}
                        className="flex-row items-center justify-between p-3 rounded-2xl border"
                        style={{
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Plan route to ${dest.name}`}
                      >
                        <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                          <View
                            className="h-9 w-9 items-center justify-center rounded-xl"
                            style={{ backgroundColor: colors.subtle }}
                          >
                            <IconComp size={17} color={colors.text} />
                          </View>
                          <View className="flex-1 justify-center">
                            <View className="flex-row items-center gap-1.5 flex-wrap">
                              <Text
                                className="font-inter-bold text-xs"
                                style={{ color: colors.text }}
                                numberOfLines={1}
                              >
                                {dest.name}
                              </Text>
                              <View
                                className="px-1.5 py-0.5 rounded-md"
                                style={{ backgroundColor: colors.subtle }}
                              >
                                <Text
                                  className="font-inter-semibold text-[9px]"
                                  style={{ color: colors.textSecondary }}
                                >
                                  {dest.category}
                                </Text>
                              </View>
                              <View
                                className="px-1.5 py-0.5 rounded-md border"
                                style={{
                                  backgroundColor: colors.brandSoft,
                                  borderColor: colors.brandBorder,
                                }}
                              >
                                <Text
                                  className="font-mono-bold text-[9px]"
                                  style={{ color: colors.brandText }}
                                >
                                  {formatDistanceLabel(dest.distanceMeters)}
                                </Text>
                              </View>
                            </View>
                            <Text
                              className="font-inter text-[11px] mt-0.5"
                              style={{ color: colors.textMuted }}
                              numberOfLines={1}
                            >
                              {dest.address}
                            </Text>
                          </View>
                        </View>
                        <ArrowRight size={14} color={colors.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
