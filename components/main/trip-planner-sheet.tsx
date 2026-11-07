import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
  Navigation,
  Search,
  ShieldAlert,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { AppButton } from "@/components/ui/app-button";
import { Touchable } from "@/components/ui/touchable";
import {
  routingService,
  type SearchLocationResult,
  type PlannedRoute,
} from "@/services/api/routing.service";
import type { LatLng } from "@/components/map/map-data";
import type { PotholeCluster } from "@/types/api";

export interface TripPlannerSheetProps {
  visible: boolean;
  onClose: () => void;
  userCoords?: LatLng | null;
  clusters?: PotholeCluster[];
  activeRoute?: PlannedRoute | null;
  onRouteCalculated?: (route: PlannedRoute | null) => void;
  onStartRideWithRoute?: (route: PlannedRoute) => void;
}

const POPULAR_DESTINATIONS: Array<{ name: string; address: string; coords: LatLng }> = [
  {
    name: "Bundaran HI",
    address: "Menteng, Jakarta Pusat",
    coords: { latitude: -6.1951, longitude: 106.8232 },
  },
  {
    name: "Stasiun Sudirman",
    address: "Jl. Kendal, Menteng, Jakarta Pusat",
    coords: { latitude: -6.2023, longitude: 106.8236 },
  },
  {
    name: "SCBD Lot 8",
    address: "Kebayoran Baru, Jakarta Selatan",
    coords: { latitude: -6.2255, longitude: 106.8097 },
  },
  {
    name: "Monumen Nasional (Monas)",
    address: "Gambir, Jakarta Pusat",
    coords: { latitude: -6.1754, longitude: 106.8272 },
  },
];

export function TripPlannerSheet({
  visible,
  onClose,
  userCoords,
  clusters = [],
  activeRoute,
  onRouteCalculated,
  onStartRideWithRoute,
}: TripPlannerSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchLocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultStart: LatLng = userCoords || {
    latitude: -6.2088,
    longitude: 106.8206,
  };

  // Debounced geocoding search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await routingService.searchLocation(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.warn("[TripPlannerSheet] Error search:", err);
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectDestination = useCallback(
    async (destName: string, destCoords: LatLng) => {
      Keyboard.dismiss();
      setSearchResults([]);
      setSearchQuery(destName);
      setIsCalculatingRoute(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      try {
        const route = await routingService.calculateRoute(
          defaultStart,
          destCoords,
          destName,
          clusters
        );

        if (route) {
          onRouteCalculated?.(route);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => {}
          );
        }
      } catch (err) {
        console.warn("[TripPlannerSheet] Gagal menghitung rute:", err);
      } finally {
        setIsCalculatingRoute(false);
      }
    },
    [defaultStart, clusters, onRouteCalculated]
  );

  const handleClearRoute = () => {
    setSearchQuery("");
    setSearchResults([]);
    onRouteCalculated?.(null);
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.max(1, Math.round(seconds / 60));
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      return `${hrs} jam ${rem > 0 ? `${rem} mnt` : ""}`;
    }
    return `${mins} menit`;
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[85%] rounded-t-3xl bg-white px-5 pt-3 pb-8 shadow-2xl">
          {/* Handle Bar */}
          <View className="w-10 h-1 bg-slate-300 rounded-full self-center mb-2" />

          {/* Header Bar */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-sky-50 border border-sky-100">
                <Compass size={18} color="#009EFF" />
              </View>
              <Text className="font-chivo-bold text-lg text-slate-900">
                Rencanakan Perjalanan
              </Text>
            </View>

            <Touchable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 border border-slate-200"
              accessibilityRole="button"
              accessibilityLabel="Tutup perencanaan rute"
            >
              <X size={16} color="#475569" />
            </Touchable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="pt-3 pb-4 gap-4"
          >
            {/* INPUT PENCARIAN TUJUAN */}
            <View className="gap-2.5">
              {/* Origin Display (Lokasi Saya) */}
              <View className="flex-row items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <View className="h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-sky-100" />
                <View className="flex-1">
                  <Text className="font-quicksand text-[11px] text-slate-600">
                    Titik Berangkat
                  </Text>
                  <Text className="font-quicksand-bold text-xs text-slate-800" numberOfLines={1}>
                    Lokasi Saya Saat Ini (GPS Terkunci)
                  </Text>
                </View>
              </View>

              {/* Destination Search Input */}
              <View className="flex-row items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-sky-300 shadow-sm focus:border-brand">
                <MapPin size={18} color="#009EFF" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Ketik lokasi atau nama jalan tujuan..."
                  placeholderTextColor="#94A3B8"
                  className="flex-1 font-quicksand-bold text-sm text-slate-900 py-1"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {isSearching ? (
                  <ActivityIndicator size="small" color="#009EFF" />
                ) : searchQuery.length > 0 ? (
                  <Touchable onPress={handleClearRoute} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={16} color="#94A3B8" />
                  </Touchable>
                ) : (
                  <Search size={16} color="#94A3B8" />
                )}
              </View>
            </View>

            {/* HASIL PENCARIAN NOMINATIM AUTOCOMPLETE */}
            {searchResults.length > 0 ? (
              <View className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <Text className="font-quicksand-bold text-xs text-slate-600 uppercase tracking-wider px-3.5 pt-3 pb-1">
                  Hasil Pencarian Lokasi
                </Text>
                {searchResults.map((res) => (
                  <Touchable
                    key={res.id}
                    onPress={() =>
                      handleSelectDestination(res.name, {
                        latitude: res.latitude,
                        longitude: res.longitude,
                      })
                    }
                    className="flex-row items-center gap-2.5 px-3.5 py-3 border-t border-slate-100"
                    accessibilityRole="button"
                    accessibilityLabel={`Pilih ${res.name}`}
                  >
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-sky-50">
                      <MapPin size={14} color="#009EFF" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-quicksand-bold text-xs text-slate-900" numberOfLines={1}>
                        {res.name}
                      </Text>
                      <Text className="font-quicksand text-[11px] text-slate-500" numberOfLines={1}>
                        {res.address}
                      </Text>
                    </View>
                  </Touchable>
                ))}
              </View>
            ) : null}

            {/* KARTU PREVIEW RUTE & ANALISIS KERUSAKAN JALAN */}
            {isCalculatingRoute ? (
              <View className="p-6 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200 gap-2">
                <ActivityIndicator size="small" color="#009EFF" />
                <Text className="font-quicksand text-xs text-slate-600">
                  Menghitung rute navigasi & memindai lubang jalan...
                </Text>
              </View>
            ) : activeRoute ? (
              <View className="rounded-2xl border border-slate-200 bg-white p-4 gap-3 shadow-md">
                {/* Header Rute */}
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-2">
                    <Text className="font-chivo-bold text-base text-slate-900" numberOfLines={1}>
                      Menuju {activeRoute.destinationName}
                    </Text>
                    <View className="flex-row items-center gap-3 mt-1">
                      <View className="flex-row items-center gap-1">
                        <Navigation size={13} color="#009EFF" />
                        <Text className="font-mono-bold text-xs text-slate-700">
                          {formatDistance(activeRoute.distanceMeters)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Clock size={13} color="#64748B" />
                        <Text className="font-mono-bold text-xs text-slate-700">
                          {formatDuration(activeRoute.durationSeconds)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Safety Rating Badge */}
                  <View
                    className={`px-2.5 py-1 rounded-full border ${
                      activeRoute.hazards.safetyRating === "dangerous"
                        ? "bg-rose-50 border-rose-200"
                        : activeRoute.hazards.safetyRating === "caution"
                        ? "bg-amber-50 border-amber-200"
                        : "bg-emerald-50 border-emerald-200"
                    }`}
                  >
                    <Text
                      className={`font-quicksand-bold text-[11px] ${
                        activeRoute.hazards.safetyRating === "dangerous"
                          ? "text-rose-700"
                          : activeRoute.hazards.safetyRating === "caution"
                          ? "text-amber-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {activeRoute.hazards.safetyRating === "dangerous"
                        ? "Jalur Rawan"
                        : activeRoute.hazards.safetyRating === "caution"
                        ? "Waspada"
                        : "Jalan Mulus"}
                    </Text>
                  </View>
                </View>

                {/* Road Hazard Assessment Card */}
                <View className="rounded-xl bg-slate-50 border border-slate-100 p-3 gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                      <ShieldAlert
                        size={15}
                        color={
                          activeRoute.hazards.safetyRating === "dangerous"
                            ? "#E11D48"
                            : activeRoute.hazards.safetyRating === "caution"
                            ? "#D97706"
                            : "#059669"
                        }
                      />
                      <Text className="font-quicksand-bold text-xs text-slate-800">
                        {activeRoute.hazards.safetyLabel}
                      </Text>
                    </View>
                    <Text className="font-mono-bold text-xs text-slate-600">
                      {activeRoute.hazards.totalHazards} titik terdeteksi
                    </Text>
                  </View>

                  <Text className="font-quicksand text-[11px] text-slate-500">
                    Densitas: ~{activeRoute.hazards.hazardDensityPerKm} titik/km dalam koridor jalan 35m.
                    {activeRoute.hazards.severeCount > 0
                      ? ` Terdapat ${activeRoute.hazards.severeCount} lubang tingkat severe!`
                      : ""}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-2 pt-1">
                  <View className="flex-1">
                    <AppButton
                      variant="primary"
                      size="md"
                      label="Mulai Berkendara"
                      iconRight={<ArrowRight size={16} color="#FFFFFF" />}
                      onPress={() => {
                        onClose();
                        onStartRideWithRoute?.(activeRoute);
                      }}
                      accessibilityLabel="Mulai berkendara dengan rute navigasi terpilih"
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {/* REKOMENDASI TUJUAN POPULER KORIDOR UTAMA */}
            {!activeRoute && searchResults.length === 0 ? (
              <View className="gap-2">
                <Text className="font-quicksand-bold text-xs text-slate-600 uppercase tracking-wider px-1">
                  Tujuan Populer di Sekitar
                </Text>
                {POPULAR_DESTINATIONS.map((dest) => (
                  <Touchable
                    key={dest.name}
                    onPress={() => handleSelectDestination(dest.name, dest.coords)}
                    className="flex-row items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white shadow-sm"
                    accessibilityRole="button"
                    accessibilityLabel={`Rencanakan rute ke ${dest.name}`}
                  >
                    <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                      <View className="h-8 w-8 items-center justify-center rounded-xl bg-slate-100">
                        <MapPin size={16} color="#009EFF" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-quicksand-bold text-xs text-slate-900">
                          {dest.name}
                        </Text>
                        <Text className="font-quicksand text-[11px] text-slate-500" numberOfLines={1}>
                          {dest.address}
                        </Text>
                      </View>
                    </View>
                    <ArrowRight size={14} color="#94A3B8" />
                  </Touchable>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
