import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  Bell,
  ChevronRight,
  Compass,
  Info,
  Moon,
  Shield,
  Smartphone,
  Sun,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useAppTheme,
  type ThemePreference,
} from "@/contexts/theme-context";
import { useVehicle } from "@/contexts/vehicle-context";

const NOTIFICATIONS_STORAGE_KEY = "@hypergrid/notifications_enabled";

const THEME_OPTIONS: {
  id: ThemePreference;
  label: string;
  Icon: typeof Sun;
}[] = [
  { id: "system", label: "System", Icon: Smartphone },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
];

type SettingsModalKind = "privacy" | "about" | null;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { themePreference, resolvedTheme, colors, setThemePreference } =
    useAppTheme();
  const { vehicleProfile } = useVehicle();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activeModal, setActiveModal] = useState<SettingsModalKind>(null);

  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
      .then((val) => {
        if (val === "false") setNotificationsEnabled(false);
      })
      .catch(() => {});
  }, []);

  const handleSelectTheme = useCallback(
    (pref: ThemePreference) => {
      Haptics.selectionAsync().catch(() => {});
      setThemePreference(pref);
    },
    [setThemePreference]
  );

  const handleToggleNotifications = useCallback((nextVal: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setNotificationsEnabled(nextVal);
    AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(nextVal)).catch(
      () => {}
    );
  }, []);

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const themeCaption =
    themePreference === "system"
      ? `Auto (${resolvedTheme === "dark" ? "Dark" : "Light"})`
      : themePreference === "dark"
      ? "Dark"
      : "Light";

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.canvas, paddingTop: insets.top }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom + 24, 36),
        }}
      >
        {/* Header */}
        <View className="mb-6">
          <Text
            className="font-inter-extrabold text-[28px] tracking-tight"
            style={{ color: colors.text }}
          >
            Settings
          </Text>
        </View>

        {/* Appearance Card */}
        <View
          className="rounded-[20px] p-4 mb-5 border"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="font-inter-bold text-base"
              style={{ color: colors.text }}
            >
              Appearance
            </Text>
            <Text
              className="font-inter-medium text-xs"
              style={{ color: colors.textMuted }}
            >
              {themeCaption}
            </Text>
          </View>

          <View
            className="flex-row rounded-[14px] p-1 border"
            style={{
              backgroundColor: colors.subtle,
              borderColor: colors.border,
            }}
          >
            {THEME_OPTIONS.map(({ id, label, Icon }) => {
              const selected = themePreference === id;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => handleSelectTheme(id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-[10px]"
                  style={
                    selected
                      ? { backgroundColor: colors.brand }
                      : { backgroundColor: "transparent" }
                  }
                >
                  <Icon
                    size={15}
                    color={selected ? "#FFFFFF" : colors.textSecondary}
                    strokeWidth={selected ? 2.3 : 1.9}
                  />
                  <Text
                    className="font-inter-semibold text-[13px]"
                    style={{
                      color: selected ? "#FFFFFF" : colors.textSecondary,
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Preferences & Tools Card */}
        <View
          className="rounded-[20px] border overflow-hidden mb-5"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          {/* Notifications Row */}
          <View
            className="flex-row items-center justify-between px-4 py-3.5 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <View className="flex-row items-center gap-3 flex-1 pr-3">
              <View
                className="w-9 h-9 rounded-xl items-center justify-center"
                style={{ backgroundColor: colors.subtle }}
              >
                <Bell size={18} color={colors.brand} />
              </View>
              <View className="flex-1">
                <Text
                  className="font-inter-semibold text-[15px]"
                  style={{ color: colors.text }}
                >
                  Notifications
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.borderStrong, true: colors.brand }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Privacy & Security */}
          <TouchableOpacity
            onPress={() => setActiveModal("privacy")}
            activeOpacity={0.75}
            className="flex-row items-center justify-between px-4 py-3.5 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <View className="flex-row items-center gap-3 flex-1 pr-3">
              <View
                className="w-9 h-9 rounded-xl items-center justify-center"
                style={{ backgroundColor: colors.subtle }}
              >
                <Shield size={18} color={colors.brand} />
              </View>
              <View className="flex-1">
                <Text
                  className="font-inter-semibold text-[15px]"
                  style={{ color: colors.text }}
                >
                  Privacy & Security
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* App Guide */}
          <TouchableOpacity
            onPress={() => router.push("/(onboarding)")}
            activeOpacity={0.75}
            className="flex-row items-center justify-between px-4 py-3.5 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <View className="flex-row items-center gap-3 flex-1 pr-3">
              <View
                className="w-9 h-9 rounded-xl items-center justify-center"
                style={{ backgroundColor: colors.subtle }}
              >
                <Compass size={18} color={colors.brand} />
              </View>
              <View className="flex-1">
                <Text
                  className="font-inter-semibold text-[15px]"
                  style={{ color: colors.text }}
                >
                  App Guide
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* About App */}
          <TouchableOpacity
            onPress={() => setActiveModal("about")}
            activeOpacity={0.75}
            className="flex-row items-center justify-between px-4 py-3.5"
          >
            <View className="flex-row items-center gap-3 flex-1 pr-3">
              <View
                className="w-9 h-9 rounded-xl items-center justify-center"
                style={{ backgroundColor: colors.subtle }}
              >
                <Info size={18} color={colors.brand} />
              </View>
              <View className="flex-1">
                <Text
                  className="font-inter-semibold text-[15px]"
                  style={{ color: colors.text }}
                >
                  About App
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text
                className="font-mono-bold text-xs"
                style={{ color: colors.textMuted }}
              >
                v{appVersion}
              </Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Privacy / About Modal */}
      <Modal
        visible={activeModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <Pressable
          className="flex-1 justify-center items-center px-5"
          style={{ backgroundColor: colors.overlay }}
          onPress={() => setActiveModal(null)}
        >
          <Pressable
            className="w-full rounded-[24px] p-5 border"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="font-inter-bold text-lg"
                style={{ color: colors.text }}
              >
                {activeModal === "privacy"
                  ? "Privacy & Security"
                  : "About HyperGrid"}
              </Text>
              <TouchableOpacity
                onPress={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.subtle }}
              >
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {activeModal === "privacy" ? (
              <View className="gap-3">
                <Text
                  className="font-inter text-[13px] leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  Motion sensor data is analyzed directly on your phone.
                </Text>
                <Text
                  className="font-inter text-[13px] leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  Only confirmed hazard locations and shock strength are
                  uploaded when a bump or pothole is detected.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                <Text
                  className="font-inter text-[13px] leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  HyperGrid maps road hazards detected by your vehicle sensors
                  while you drive.
                </Text>
                <View
                  className="rounded-xl p-3.5 border gap-1.5"
                  style={{
                    backgroundColor: colors.subtle,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    className="font-inter-semibold text-xs"
                    style={{ color: colors.text }}
                  >
                    App Version: {appVersion}
                  </Text>
                  <Text
                    className="font-inter text-xs"
                    style={{ color: colors.textMuted }}
                  >
                    Active Profile: {vehicleProfile.name}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setActiveModal(null)}
              activeOpacity={0.85}
              className="mt-5 py-3 rounded-xl items-center"
              style={{ backgroundColor: colors.brand }}
            >
              <Text className="font-inter-bold text-sm text-white">Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
