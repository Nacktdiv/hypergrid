import * as Haptics from "expo-haptics";
import {
  AlertTriangle,
  Check,
  Flame,
  HeartPulse,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  Radio,
  Share2,
  Shield,
  Truck,
  X,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LatLng } from "@/components/map/map-data";
import { useOptionalTheme } from "@/contexts/theme-context";

export interface EmergencyModalProps {
  visible: boolean;
  onClose: () => void;
  currentCoords?: LatLng | null;
  speedKmh?: number;
}

interface HotlineCardData {
  number: string;
  name: string;
  desc: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  accentColor: string;
  badgeClass: string;
}

const SPECIFIC_HOTLINES: HotlineCardData[] = [
  {
    number: "110",
    name: "National Police",
    desc: "Security & Accidents",
    icon: Shield,
    accentColor: "#0A84FF",
    badgeClass:
      "bg-sky-50 dark:bg-sky-500/15 border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300",
  },
  {
    number: "119",
    name: "Medical Ambulance",
    desc: "Emergency & Hospital",
    icon: HeartPulse,
    accentColor: "#10B981",
    badgeClass:
      "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  },
  {
    number: "14080",
    name: "Highway Towing",
    desc: "Toll Road Assistance",
    icon: Truck,
    accentColor: "#F59E0B",
    badgeClass:
      "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300",
  },
  {
    number: "113",
    name: "Fire & Rescue",
    desc: "Fire & Evacuation",
    icon: Flame,
    accentColor: "#F97316",
    badgeClass:
      "bg-orange-50 dark:bg-orange-500/15 border-orange-200 dark:border-orange-500/30 text-orange-700 dark:text-orange-300",
  },
];

export function EmergencyModal({
  visible,
  onClose,
  currentCoords,
  speedKmh,
}: EmergencyModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useOptionalTheme();
  const [copiedRecently, setCopiedRecently] = useState(false);

  const handleDial = useCallback(async (number: string, title: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    const url = `tel:${number}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported || Platform.OS !== "web") {
        await Linking.openURL(url);
      } else {
        Alert.alert("Dial Error", `Could not dial ${number} (${title})`);
      }
    } catch {
      Alert.alert("Dial Error", `Failed to call ${number}`);
    }
  }, []);

  const generateEmergencyMessage = useCallback(() => {
    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateStr = new Date().toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const lat = currentCoords ? currentCoords.latitude.toFixed(6) : "Unknown";
    const lon = currentCoords ? currentCoords.longitude.toFixed(6) : "Unknown";
    const mapUrl = currentCoords
      ? `https://maps.google.com/?q=${currentCoords.latitude},${currentCoords.longitude}`
      : "GPS fix pending";
    const speedStr =
      speedKmh != null && speedKmh > 0
        ? `~${Math.round(speedKmh)} km/h`
        : "Vehicle Stopped";

    return (
      `[HYPERGRID SOS] EMERGENCY ASSISTANCE\n\n` +
      `I require immediate assistance at this location:\n` +
      `Coordinates: ${lat}, ${lon}\n` +
      `Google Maps: ${mapUrl}\n` +
      `Speed: ${speedStr}\n` +
      `Time: ${dateStr} ${timeStr}\n\n` +
      `Dispatched via HyperGrid Road Telemetry System.`
    );
  }, [currentCoords, speedKmh]);

  const handleShareWhatsApp = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const text = generateEmergencyMessage();
    const waUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const webWaUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

    try {
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
      } else {
        await Linking.openURL(webWaUrl);
      }
    } catch {
      try {
        await Share.share({ message: text });
      } catch (err) {
        console.warn("[EmergencyModal] Failed to share via WhatsApp:", err);
      }
    }
  }, [generateEmergencyMessage]);

  const handleShareUniversal = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const text = generateEmergencyMessage();
    try {
      await Share.share({
        message: text,
        title: "HyperGrid Emergency SOS Location",
      });
      setCopiedRecently(true);
      setTimeout(() => setCopiedRecently(false), 2500);
    } catch (err) {
      console.warn("[EmergencyModal] Failed to share link:", err);
    }
  }, [generateEmergencyMessage]);

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
          accessibilityLabel="Close emergency dialog backdrop"
        />

        <View
          className="max-h-[86%] rounded-t-[32px] border-t px-5 pt-3 shadow-2xl"
          style={{
            backgroundColor: colors.sheet,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          }}
        >
          {/* Centered Drag Handle */}
          <View
            className="w-12 h-1.5 rounded-full self-center mb-3.5"
            style={{ backgroundColor: colors.borderStrong }}
          />

          {/* Modal Header */}
          <View
            className="flex-row items-center justify-between pb-3.5 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <View className="flex-row items-center gap-3">
              <View
                className="h-10 w-10 items-center justify-center rounded-2xl border"
                style={{
                  backgroundColor: colors.dangerSoft,
                  borderColor: colors.danger,
                }}
              >
                <AlertTriangle size={20} color={colors.danger} strokeWidth={2.5} />
              </View>
              <View>
                <Text
                  className="font-inter-bold text-lg leading-tight"
                  style={{ color: colors.text }}
                >
                  Emergency Assistance (SOS)
                </Text>
                <Text
                  className="font-inter text-xs mt-0.5"
                  style={{ color: colors.textMuted }}
                >
                  Hotlines & Live Location
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
              accessibilityLabel="Close emergency dialog"
            >
              <X size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pt-3.5 pb-2 gap-4"
          >
            {/* 1. HERO EMERGENCY CALL 112 (TOLL-FREE) */}
            <View
              className="rounded-2xl border p-4 gap-3"
              style={{
                backgroundColor: colors.dangerSoft,
                borderColor: colors.danger,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="px-2.5 py-0.5 rounded-full bg-rose-600">
                  <Text className="font-mono-bold text-[10px] text-white uppercase tracking-wider">
                    Toll-Free · 24/7
                  </Text>
                </View>
                <Text
                  className="font-inter-semibold text-xs"
                  style={{ color: colors.dangerText }}
                >
                  All GSM Operators
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text
                    className="font-inter-bold text-xl"
                    style={{ color: colors.text }}
                  >
                    National Emergency 112
                  </Text>
                  <Text
                    className="font-inter text-xs mt-0.5"
                    style={{ color: colors.textSecondary }}
                  >
                    Unified dispatch service connecting to nearest responders.
                  </Text>
                </View>

                <Pressable
                  onPress={() => handleDial("112", "National Emergency 112")}
                  className="h-11 px-4 rounded-xl bg-rose-600 flex-row items-center gap-2 shadow-sm active:bg-rose-700"
                  accessibilityRole="button"
                  accessibilityLabel="Call 112 now"
                >
                  <PhoneCall size={16} color="#FFFFFF" />
                  <Text className="font-inter-bold text-xs text-white">
                    Call 112
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 2. LIVE LOCATION TELEMETRY & QUICK SHARE */}
            <View
              className="rounded-2xl border p-4 gap-3"
              style={{
                backgroundColor: colors.cardMuted,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <MapPin size={16} color={colors.brand} />
                  <Text
                    className="font-inter-bold text-xs uppercase tracking-wider"
                    style={{ color: colors.textSecondary }}
                  >
                    Your Current GPS Position
                  </Text>
                </View>
                <View
                  className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <Radio size={11} color={colors.success} />
                  <Text
                    className="font-mono-bold text-[10px]"
                    style={{ color: colors.successText }}
                  >
                    {speedKmh != null && speedKmh > 0
                      ? `~${Math.round(speedKmh)} km/h`
                      : "Vehicle Stopped"}
                  </Text>
                </View>
              </View>

              <View
                className="px-3 py-2.5 rounded-xl border"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <Text
                  className="font-mono-bold text-xs"
                  style={{ color: colors.text }}
                >
                  {currentCoords
                    ? `${currentCoords.latitude.toFixed(6)}, ${currentCoords.longitude.toFixed(6)}`
                    : "Acquiring GPS fix..."}
                </Text>
                <Text
                  className="font-inter text-[11px] mt-0.5"
                  style={{ color: colors.textMuted }}
                >
                  Live coordinates and map link ready to dispatch to contacts.
                </Text>
              </View>

              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={handleShareWhatsApp}
                  className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 active:bg-emerald-700"
                  accessibilityRole="button"
                  accessibilityLabel="Send emergency coordinates via WhatsApp"
                >
                  <MessageCircle size={15} color="#FFFFFF" />
                  <Text className="font-inter-bold text-xs text-white">
                    Send WhatsApp
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleShareUniversal}
                  className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl border"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.borderStrong,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Share location link"
                >
                  {copiedRecently ? (
                    <Check size={14} color={colors.success} />
                  ) : (
                    <Share2 size={14} color={colors.textSecondary} />
                  )}
                  <Text
                    className="font-inter-bold text-xs"
                    style={{ color: colors.text }}
                  >
                    {copiedRecently ? "Copied!" : "Share Location"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 3. DIRECT EMERGENCY SERVICES (1-TAP CALL) */}
            <View className="gap-2.5">
              <Text
                className="font-inter-bold text-xs uppercase tracking-wider px-1"
                style={{ color: colors.textMuted }}
              >
                Direct Emergency Services (1-Tap Call)
              </Text>

              <View className="flex-row flex-wrap gap-2.5">
                {SPECIFIC_HOTLINES.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <Pressable
                      key={item.number}
                      onPress={() => handleDial(item.number, item.name)}
                      className="w-[48.2%] p-3 rounded-2xl border justify-between gap-2"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${item.name} at ${item.number}`}
                    >
                      <View className="flex-row items-center justify-between">
                        <View
                          className="h-8 w-8 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${item.accentColor}20` }}
                        >
                          <IconComp size={16} color={item.accentColor} />
                        </View>
                        <View
                          className={`px-2 py-0.5 rounded-md border ${item.badgeClass}`}
                        >
                          <Text className="font-mono-bold text-[10px]">
                            {item.number}
                          </Text>
                        </View>
                      </View>

                      <View>
                        <Text
                          className="font-inter-bold text-xs leading-tight"
                          style={{ color: colors.text }}
                        >
                          {item.name}
                        </Text>
                        <Text
                          className="font-inter text-[10px] mt-0.5"
                          style={{ color: colors.textMuted }}
                          numberOfLines={1}
                        >
                          {item.desc}
                        </Text>
                      </View>

                      <View
                        className="flex-row items-center gap-1 pt-1.5 border-t"
                        style={{ borderTopColor: colors.border }}
                      >
                        <Phone size={11} color={item.accentColor} />
                        <Text
                          className="font-inter-bold text-[10px]"
                          style={{ color: item.accentColor }}
                        >
                          Call Now
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
