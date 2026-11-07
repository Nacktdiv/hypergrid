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
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LatLng } from "@/components/map/map-data";

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
  badgeBg: string;
}

const SPECIFIC_HOTLINES: HotlineCardData[] = [
  {
    number: "110",
    name: "National Police",
    desc: "Security & Accidents",
    icon: Shield,
    accentColor: "#2563EB",
    badgeBg: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    number: "119",
    name: "Medical Ambulance",
    desc: "Emergency & Hospital",
    icon: HeartPulse,
    accentColor: "#059669",
    badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    number: "14080",
    name: "Highway Towing",
    desc: "Toll Road Assistance",
    icon: Truck,
    accentColor: "#D97706",
    badgeBg: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    number: "113",
    name: "Fire & Rescue",
    desc: "Fire & Evacuation",
    icon: Flame,
    accentColor: "#EA580C",
    badgeBg: "bg-orange-50 border-orange-200 text-orange-700",
  },
];

export function EmergencyModal({
  visible,
  onClose,
  currentCoords,
  speedKmh,
}: EmergencyModalProps) {
  const insets = useSafeAreaInsets();
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
      `🚨 *EMERGENCY ASSISTANCE (HYPERGRID SOS)* 🚨\n\n` +
      `I require immediate assistance at this location:\n` +
      `📍 *Coordinates:* ${lat}, ${lon}\n` +
      `🗺️ *Google Maps Link:* ${mapUrl}\n` +
      `🚗 *Speed:* ${speedStr}\n` +
      `🕒 *Time:* ${dateStr} ${timeStr}\n\n` +
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
      <View className="flex-1 justify-end bg-black/60">
        <Pressable
          onPress={onClose}
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Close emergency dialog backdrop"
        />

        <View
          className="max-h-[86%] rounded-t-[32px] bg-white px-5 pt-3 shadow-2xl"
          style={{
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          }}
        >
          {/* Centered Drag Handle */}
          <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-3.5" />

          {/* Modal Header */}
          <View className="flex-row items-center justify-between pb-3.5 border-b border-slate-100">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100">
                <AlertTriangle size={20} color="#E11D48" strokeWidth={2.5} />
              </View>
              <View>
                <Text className="font-chivo-bold text-lg text-slate-900 leading-tight">
                  Emergency Assistance (SOS)
                </Text>
                <Text className="font-quicksand text-xs text-slate-500 mt-0.5">
                  National Hotlines & Instant Location Sharing
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 border border-slate-200"
              accessibilityRole="button"
              accessibilityLabel="Close emergency dialog"
            >
              <X size={16} color="#475569" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pt-3.5 pb-2 gap-4"
          >
            {/* 1. HERO EMERGENCY CALL 112 (TOLL-FREE) */}
            <View className="rounded-2xl border-2 border-rose-200 bg-rose-50/70 p-4 gap-3">
              <View className="flex-row items-center justify-between">
                <View className="px-2.5 py-0.5 rounded-full bg-rose-600">
                  <Text className="font-mono-bold text-[10px] text-white uppercase tracking-wider">
                    Toll-Free • 24/7
                  </Text>
                </View>
                <Text className="font-quicksand text-xs text-rose-800 font-semibold">
                  All GSM Operators
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="font-chivo-bold text-xl text-slate-900">
                    National Emergency 112
                  </Text>
                  <Text className="font-quicksand text-xs text-slate-600 mt-0.5">
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
                  <Text className="font-chivo-bold text-xs text-white">
                    Call 112
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 2. LIVE LOCATION TELEMETRY & QUICK SHARE */}
            <View className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <MapPin size={16} color="#009EFF" />
                  <Text className="font-quicksand-bold text-xs text-slate-700 uppercase tracking-wider">
                    Your Current GPS Position
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-slate-200">
                  <Radio size={11} color="#10B981" />
                  <Text className="font-mono-bold text-[10px] text-emerald-700">
                    {speedKmh != null && speedKmh > 0
                      ? `~${Math.round(speedKmh)} km/h`
                      : "Vehicle Stopped"}
                  </Text>
                </View>
              </View>

              <View className="px-3 py-2 rounded-xl bg-white border border-slate-200">
                <Text className="font-mono-bold text-xs text-slate-900">
                  {currentCoords
                    ? `${currentCoords.latitude.toFixed(6)}, ${currentCoords.longitude.toFixed(6)}`
                    : "Acquiring GPS fix..."}
                </Text>
                <Text className="font-quicksand text-[11px] text-slate-500 mt-0.5">
                  Live coordinates and map link ready to dispatch to contacts.
                </Text>
              </View>

              <View className="flex-row gap-2.5">
                {/* Share WhatsApp */}
                <Pressable
                  onPress={handleShareWhatsApp}
                  className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 active:bg-emerald-700 shadow-2xs"
                  accessibilityRole="button"
                  accessibilityLabel="Send emergency coordinates via WhatsApp"
                >
                  <MessageCircle size={15} color="#FFFFFF" />
                  <Text className="font-quicksand-bold text-xs text-white">
                    Send WhatsApp
                  </Text>
                </Pressable>

                {/* Share Universal / SMS */}
                <Pressable
                  onPress={handleShareUniversal}
                  className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-slate-300 active:bg-slate-100 shadow-2xs"
                  accessibilityRole="button"
                  accessibilityLabel="Share location link"
                >
                  {copiedRecently ? (
                    <Check size={14} color="#10B981" />
                  ) : (
                    <Share2 size={14} color="#334155" />
                  )}
                  <Text className="font-quicksand-bold text-xs text-slate-800">
                    {copiedRecently ? "Copied!" : "Share Location"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 3. DIRECT EMERGENCY SERVICES (1-TAP CALL) */}
            <View className="gap-2.5">
              <Text className="font-quicksand-bold text-xs text-slate-500 uppercase tracking-wider px-1">
                Direct Emergency Services (1-Tap Call)
              </Text>

              <View className="flex-row flex-wrap gap-2.5">
                {SPECIFIC_HOTLINES.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <Pressable
                      key={item.number}
                      onPress={() => handleDial(item.number, item.name)}
                      className="w-[48.2%] p-3 rounded-2xl border border-slate-200/90 bg-white active:bg-slate-50 shadow-2xs justify-between gap-2"
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${item.name} at ${item.number}`}
                    >
                      <View className="flex-row items-center justify-between">
                        <View
                          className="h-8 w-8 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${item.accentColor}15` }}
                        >
                          <IconComp size={16} color={item.accentColor} />
                        </View>
                        <View className={`px-2 py-0.5 rounded-md border ${item.badgeBg}`}>
                          <Text className="font-mono-bold text-[10px]">
                            {item.number}
                          </Text>
                        </View>
                      </View>

                      <View>
                        <Text className="font-quicksand-bold text-xs text-slate-900 leading-tight">
                          {item.name}
                        </Text>
                        <Text
                          className="font-quicksand text-[10px] text-slate-500 mt-0.5"
                          numberOfLines={1}
                        >
                          {item.desc}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-1 pt-1 border-t border-slate-100">
                        <Phone size={11} color={item.accentColor} />
                        <Text
                          className="font-quicksand-bold text-[10px]"
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
