import React, { useCallback } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import {
  AlertTriangle,
  Flame,
  HeartPulse,
  MessageCircle,
  Phone,
  PhoneCall,
  Send,
  Shield,
  Truck,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Touchable } from "@/components/ui/touchable";
import type { LatLng } from "@/components/map/map-data";

export interface EmergencyModalProps {
  visible: boolean;
  onClose: () => void;
  currentCoords?: LatLng | null;
  speedKmh?: number;
}

interface Hotline {
  number: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  accentColor: string;
  bgBadge: string;
}

const EMERGENCY_HOTLINES: Hotline[] = [
  {
    number: "112",
    title: "Panggilan Darurat Bebas Pulsa",
    subtitle: "Layanan Terpadu Nasional (Semua Operator)",
    icon: PhoneCall,
    accentColor: "#E11D48",
    bgBadge: "bg-rose-50 border-rose-200",
  },
  {
    number: "110",
    title: "Kepolisian RI",
    subtitle: "Bantuan Keamanan, Kecelakaan & Kriminalitas",
    icon: Shield,
    accentColor: "#2563EB",
    bgBadge: "bg-blue-50 border-blue-200",
  },
  {
    number: "119",
    title: "Ambulans & Gawat Darurat",
    subtitle: "Layanan Medis Darurat & Rumah Sakit",
    icon: HeartPulse,
    accentColor: "#059669",
    bgBadge: "bg-emerald-50 border-emerald-200",
  },
  {
    number: "14080",
    title: "Jasa Marga & Derek Tol",
    subtitle: "Bantuan Kendaraan Mogok & Informasi Lalu Lintas Jalan Tol",
    icon: Truck,
    accentColor: "#D97706",
    bgBadge: "bg-amber-50 border-amber-200",
  },
  {
    number: "113",
    title: "Pemadam Kebakaran",
    subtitle: "Penanganan Kebakaran & Evakuasi Bahaya",
    icon: Flame,
    accentColor: "#EA580C",
    bgBadge: "bg-orange-50 border-orange-200",
  },
];

export function EmergencyModal({
  visible,
  onClose,
  currentCoords,
  speedKmh,
}: EmergencyModalProps) {
  const handleDial = useCallback(async (number: string, title: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    const url = `tel:${number}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported || Platform.OS !== "web") {
        await Linking.openURL(url);
      } else {
        Alert.alert("Dial Error", `Nomor ${number} (${title})`);
      }
    } catch {
      Alert.alert("Dial Error", `Gagal memanggil ${number}`);
    }
  }, []);

  const generateEmergencyMessage = useCallback(() => {
    const timeStr = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const dateStr = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const lat = currentCoords ? currentCoords.latitude.toFixed(6) : "Tidak diketahui";
    const lon = currentCoords ? currentCoords.longitude.toFixed(6) : "Tidak diketahui";
    const mapUrl = currentCoords
      ? `https://maps.google.com/?q=${currentCoords.latitude},${currentCoords.longitude}`
      : "GPS belum terkunci";
    const speedStr = speedKmh != null && speedKmh > 0 ? `~${Math.round(speedKmh)} km/jam` : "Diam / Berhenti";

    return (
      `🚨 *PANGGILAN DARURAT (SOS HYPERGRID)* 🚨\n\n` +
      `Saya memerlukan bantuan segera di lokasi ini:\n` +
      `📍 *Koordinat:* ${lat}, ${lon}\n` +
      `🗺️ *Tautan Google Maps:* ${mapUrl}\n` +
      `🚗 *Kecepatan:* ${speedStr}\n` +
      `🕒 *Waktu:* ${dateStr} ${timeStr} WIB\n\n` +
      `Pesan ini dikirim otomatis via HyperGrid Road Telemetry System.`
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
      // Fallback ke sistem Share bawaan OS
      try {
        await Share.share({ message: text });
      } catch (err) {
        console.warn("[EmergencyModal] Gagal membagikan lokasi:", err);
      }
    }
  }, [generateEmergencyMessage]);

  const handleShareSMS = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const text = generateEmergencyMessage();
    const smsUrl = `sms:?body=${encodeURIComponent(text)}`;

    try {
      await Linking.openURL(smsUrl);
    } catch {
      try {
        await Share.share({ message: text });
      } catch (err) {
        console.warn("[EmergencyModal] Gagal SMS:", err);
      }
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
        <View className="max-h-[90%] rounded-t-3xl bg-white px-5 pt-4 pb-8 shadow-2xl">
          {/* Header Bar */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
            <View className="flex-row items-center gap-2.5">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-rose-600 shadow-md">
                <AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View>
                <Text className="font-chivo-bold text-lg text-slate-900">
                  Pusat Bantuan Darurat
                </Text>
                <Text className="font-quicksand text-xs text-rose-600 font-semibold">
                  Hotline Siaga & Bagi Lokasi Cepat
                </Text>
              </View>
            </View>

            <Touchable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 border border-slate-200"
              accessibilityRole="button"
              accessibilityLabel="Tutup modal darurat"
            >
              <X size={16} color="#475569" />
            </Touchable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pt-3 pb-4 gap-4"
          >
            {/* 1. KARTU LOKASI SAYA SAAT INI DENGAN AKSI BERBAGI INSTAN */}
            <View className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 gap-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="font-quicksand-bold text-xs text-rose-950 uppercase tracking-wider">
                    Posisi GPS Anda
                  </Text>
                  <Text className="font-mono-bold text-sm text-slate-800 mt-0.5">
                    {currentCoords
                      ? `${currentCoords.latitude.toFixed(5)}, ${currentCoords.longitude.toFixed(5)}`
                      : "Mencari sinyal GPS..."}
                  </Text>
                  <Text className="font-quicksand text-[11px] text-slate-600 mt-0.5">
                    {speedKmh != null && speedKmh > 0
                      ? `Laju kendaraan: ~${Math.round(speedKmh)} km/jam`
                      : "Status: Kendaraan berhenti"}
                  </Text>
                </View>

                <View className="h-2 w-2 rounded-full bg-rose-500 animate-pulse mt-1" />
              </View>

              <View className="flex-row gap-2 pt-1 border-t border-rose-200/60">
                {/* Share WhatsApp */}
                <Touchable
                  onPress={handleShareWhatsApp}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 shadow-sm"
                  accessibilityRole="button"
                  accessibilityLabel="Kirim lokasi darurat ke WhatsApp"
                >
                  <MessageCircle size={16} color="#FFFFFF" />
                  <Text className="font-quicksand-bold text-xs text-white">
                    WhatsApp
                  </Text>
                </Touchable>

                {/* Share SMS / Lainnya */}
                <Touchable
                  onPress={handleShareSMS}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 shadow-sm"
                  accessibilityRole="button"
                  accessibilityLabel="Kirim lokasi via SMS"
                >
                  <Send size={15} color="#FFFFFF" />
                  <Text className="font-quicksand-bold text-xs text-white">
                    Kirim SMS
                  </Text>
                </Touchable>
              </View>
            </View>

            {/* 2. DAFTAR HOTLINE PANGGILAN CEPAT */}
            <View className="gap-2">
              <Text className="font-quicksand-bold text-xs text-slate-600 uppercase tracking-wider px-1">
                Panggilan Langsung (1-Tap Dial)
              </Text>

              {EMERGENCY_HOTLINES.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Touchable
                    key={item.number}
                    onPress={() => handleDial(item.number, item.title)}
                    className="flex-row items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm"
                    accessibilityRole="button"
                    accessibilityLabel={`Hubungi ${item.title} nomor ${item.number}`}
                  >
                    <View className="flex-row items-center gap-3 flex-1 pr-3">
                      <View
                        className="h-10 w-10 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${item.accentColor}18` }}
                      >
                        <IconComponent size={20} color={item.accentColor} />
                      </View>

                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="font-quicksand-bold text-sm text-slate-900">
                            {item.title}
                          </Text>
                          <View className={`px-2 py-0.5 rounded-full border ${item.bgBadge}`}>
                            <Text
                              className="font-mono-bold text-[11px]"
                              style={{ color: item.accentColor }}
                            >
                              {item.number}
                            </Text>
                          </View>
                        </View>
                        <Text
                          className="font-quicksand text-xs text-slate-500 mt-0.5"
                          numberOfLines={1}
                        >
                          {item.subtitle}
                        </Text>
                      </View>
                    </View>

                    <View
                      className="h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${item.accentColor}20` }}
                    >
                      <Phone size={15} color={item.accentColor} />
                    </View>
                  </Touchable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
