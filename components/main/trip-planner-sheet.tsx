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

interface PopularPlace {
  name: string;
  address: string;
  category: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  coords: LatLng;
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

const POPULAR_DESTINATIONS: PopularPlace[] = [
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

export function TripPlannerSheet({
  visible,
  onClose,
  userCoords,
  onSelectDestination,
}: TripPlannerSheetProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchLocationResult[]>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultStart: LatLng = useMemo(
    () => userCoords || { latitude: -6.2088, longitude: 106.8206 },
    [userCoords],
  );

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

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  // Sort popular destinations by actual distance from current user coordinates
  const nearbyPopularDestinations = useMemo(() => {
    const origin = userCoords || defaultStart;
    return POPULAR_DESTINATIONS.map((dest) => {
      const distance = calculateHaversineMeters(origin, dest.coords);
      return {
        ...dest,
        distanceMeters: distance,
      };
    }).sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [userCoords, defaultStart]);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          onPress={onClose}
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Close trip planner"
        />

        <View
          className="max-h-[82%] rounded-t-[30px] bg-white px-5 pt-3 shadow-2xl"
          style={{
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          }}
        >
          {/* Subtle Drag Handle */}
          <View className="w-10 h-1 bg-slate-300 rounded-full self-center mb-3" />

          {/* Modal Header: Clean neutral icon, English typography */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 border border-slate-200/80">
                <Compass size={18} color="#0F172A" />
              </View>
              <View>
                <Text className="font-chivo-bold text-base text-slate-900 leading-tight">
                  Trip Planner
                </Text>
                <Text className="font-quicksand text-[11px] text-slate-500 mt-0.5">
                  Eco route & road safety scanning
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 border border-slate-200"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={15} color="#475569" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="pt-3 pb-2 gap-3.5"
          >
            {/* 1. WAYPOINT JOURNEY CARD (DEPARTURE & DESTINATION INPUT) */}
            <View className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
              <View className="flex-row items-stretch">
                {/* Visual Waypoint Connectors */}
                <View className="items-center justify-between py-2 pr-3">
                  <View className="h-2.5 w-2.5 rounded-full bg-sky-500 ring-4 ring-sky-100" />
                  <View className="w-0.5 flex-1 bg-slate-300 my-1" />
                  <View className="h-3 w-3 items-center justify-center rounded-full bg-rose-500">
                    <MapPin size={8} color="#FFFFFF" />
                  </View>
                </View>

                {/* Form Fields */}
                <View className="flex-1 gap-2">
                  {/* Departure */}
                  <View className="py-0.5">
                    <Text className="font-quicksand-bold text-[10px] text-slate-400 uppercase tracking-wider">
                      Departure
                    </Text>
                    <Text
                      className="font-quicksand-bold text-xs text-slate-800 mt-0.5"
                      numberOfLines={1}
                    >
                      Current GPS Location
                    </Text>
                  </View>

                  <View className="h-[1px] bg-slate-200/80" />

                  {/* Destination Input */}
                  <View>
                    <Text className="font-quicksand-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                      Destination
                    </Text>
                    <View className="flex-row items-center px-3 py-2 rounded-xl bg-white border border-slate-200 focus:border-brand shadow-2xs">
                      <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search destination or address..."
                        placeholderTextColor="#94A3B8"
                        className="flex-1 font-quicksand-bold text-xs text-slate-900 py-0.5"
                        autoCorrect={false}
                        returnKeyType="search"
                      />
                      {isSearching ? (
                        <ActivityIndicator size="small" color="#1DA1F2" />
                      ) : searchQuery.length > 0 ? (
                        <Pressable
                          onPress={() => setSearchQuery("")}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          className="h-5 w-5 rounded-full items-center justify-center bg-slate-100 active:bg-slate-200"
                          accessibilityLabel="Clear query"
                        >
                          <X size={12} color="#64748B" />
                        </Pressable>
                      ) : (
                        <Search size={15} color="#94A3B8" />
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* 2. LIVE SEARCH RESULTS */}
            {searchResults.length > 0 ? (
              <View className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <View className="px-3.5 pt-2.5 pb-1 border-b border-slate-100 flex-row items-center justify-between">
                  <Text className="font-quicksand-bold text-[11px] text-slate-500 uppercase tracking-wider">
                    Search Results
                  </Text>
                  <Text className="font-quicksand text-[10px] text-slate-400">
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
                    className="flex-row items-center justify-between p-3 border-b border-slate-100 last:border-b-0 active:bg-slate-50"
                    accessibilityRole="button"
                    accessibilityLabel={`Choose destination ${res.name}`}
                  >
                    <View className="flex-1 pr-2">
                      <Text
                        className="font-quicksand-bold text-xs text-slate-900"
                        numberOfLines={1}
                      >
                        {res.name}
                      </Text>
                      <Text
                        className="font-quicksand text-[11px] text-slate-500 mt-0.5"
                        numberOfLines={1}
                      >
                        {res.address}
                      </Text>
                    </View>
                    <ArrowRight size={14} color="#94A3B8" />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* 3. NEARBY POPULAR DESTINATIONS (ALWAYS POPULATED & SORTED) */}
            {searchResults.length === 0 ? (
              <View className="gap-2">
                <View className="flex-row items-center justify-between px-1">
                  <Text className="font-quicksand-bold text-[11px] text-slate-500 uppercase tracking-wider">
                    Nearby Popular Destinations
                  </Text>
                  <Text className="font-quicksand text-[10px] text-slate-400">
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
                        className="flex-row items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white active:bg-slate-50 shadow-2xs"
                        accessibilityRole="button"
                        accessibilityLabel={`Plan route to ${dest.name}`}
                      >
                        <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                          <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                            <IconComp size={17} color="#0F172A" />
                          </View>
                          <View className="flex-1 justify-center">
                            <View className="flex-row items-center gap-1.5 flex-wrap">
                              <Text
                                className="font-quicksand-bold text-xs text-slate-900"
                                numberOfLines={1}
                              >
                                {dest.name}
                              </Text>
                              <View className="px-1.5 py-0.5 rounded-md bg-slate-100">
                                <Text className="font-quicksand-semibold text-[9px] text-slate-600">
                                  {dest.category}
                                </Text>
                              </View>
                              <View className="px-1.5 py-0.5 rounded-md bg-sky-50 border border-sky-100">
                                <Text className="font-mono-bold text-[9px] text-sky-700">
                                  {formatDistance(dest.distanceMeters)}
                                </Text>
                              </View>
                            </View>
                            <Text
                              className="font-quicksand text-[11px] text-slate-500 mt-0.5"
                              numberOfLines={1}
                            >
                              {dest.address}
                            </Text>
                          </View>
                        </View>
                        <ArrowRight size={14} color="#94A3B8" />
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
