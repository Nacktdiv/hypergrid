import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Activity,
  Bell,
  CarFront,
  Check,
  ChevronRight,
  CloudUpload,
  Cpu,
  Edit3,
  FileText,
  MoreHorizontal,
  PhoneCall,
  RefreshCw,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LogoutButton } from "@/components/profile/logout-button";
import { PersonalInfoList } from "@/components/profile/personal-info-list";
import { ProfileHeader } from "@/components/profile/profile-header";
import { AppButton } from "@/components/ui/app-button";
import { EmergencyModal } from "@/components/ui/emergency-modal";
import { ProfileContentSkeleton } from "@/components/ui/skeleton";
import { Touchable } from "@/components/ui/touchable";
import { useAppTheme } from "@/contexts/theme-context";
import {
  useVehicle,
  VEHICLE_PROFILES,
  type VehicleId,
} from "@/contexts/vehicle-context";
import { useAuth } from "@/hooks/use-auth";
import { useUserLocation } from "@/hooks/use-user-location";
import { getApiBaseUrl } from "@/services/api/config";
import { offlineQueue } from "@/services/api/offline-queue";
import { tripStorage } from "@/services/api/trip-storage";

const NOTIFICATIONS_STORAGE_KEY = "@hypergrid/notifications_enabled";

type InfoModalKind =
  | "calibration"
  | "sync"
  | "guide"
  | "privacy"
  | "terms"
  | "menu"
  | null;

const VEHICLE_ORDER: VehicleId[] = ["car", "motor", "bicycle"];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { user, isLoading: isAuthLoading, signOut, updateProfile } = useAuth();
  const { vehicleId, vehicleProfile, setVehicle } = useVehicle();
  const [isEmergencyVisible, setIsEmergencyVisible] = useState(false);
  const { coords } = useUserLocation(false, { enabled: isEmergencyVisible });

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "Driver");
  const [phoneInput, setPhoneInput] = useState(
    (user as any)?.phone || "+62 812-3456-7890"
  );
  const [isSaving, setIsSaving] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activeModal, setActiveModal] = useState<InfoModalKind>(null);

  const [pendingQueueCount, setPendingQueueCount] = useState(() =>
    offlineQueue.size()
  );
  const [syncedTripsCount, setSyncedTripsCount] = useState(
    () => tripStorage.getMemoryCache()?.length ?? 0
  );
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);

  const refreshSyncMetrics = useCallback(() => {
    setPendingQueueCount(offlineQueue.size());
    if (tripStorage.getMemoryCache() === null) {
      tripStorage
        .getTrips()
        .then((trips) => setSyncedTripsCount(trips.length))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
      .then((val) => {
        setNotificationsEnabled(val !== "false");
      })
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      setPendingQueueCount(offlineQueue.size());
      if (tripStorage.getMemoryCache() === null) {
        tripStorage
          .getTrips()
          .then((trips) => setSyncedTripsCount(trips.length))
          .catch(() => {});
      }
    }, [])
  );

  useEffect(() => {
    const unsub = tripStorage.subscribe((trips) => {
      setSyncedTripsCount(trips.length);
    });
    return unsub;
  }, []);

  const handleToggleNotifications = useCallback((nextVal: boolean) => {
    setNotificationsEnabled(nextVal);
    AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(nextVal)).catch(
      () => {}
    );
  }, []);

  const handleOpenEdit = useCallback(() => {
    setNameInput(user?.name || "Driver");
    setPhoneInput((user as any)?.phone || "+62 812-3456-7890");
    setEditModalVisible(true);
  }, [user]);

  const handleSaveProfile = useCallback(async () => {
    if (!nameInput.trim()) {
      Alert.alert("Attention", "Full name cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: nameInput.trim(),
        phone: phoneInput.trim(),
      });
      setEditModalVisible(false);
      Alert.alert("Success", "Profile information updated successfully.");
    } catch (err: any) {
      Alert.alert(
        "Save Failed",
        err.message || "An error occurred while saving profile."
      );
    } finally {
      setIsSaving(false);
    }
  }, [nameInput, phoneInput, updateProfile]);

  const handleFlushQueue = useCallback(async () => {
    setIsSyncingQueue(true);
    try {
      const result = await offlineQueue.flush();
      setPendingQueueCount(result.remaining);
      Alert.alert(
        "Cloud Sync Complete",
        result.uploaded > 0
          ? `Uploaded ${result.uploaded} queued detections (${result.remaining} remaining).`
          : `All buffered telemetry is already synchronized (${result.remaining} pending).`
      );
    } catch (err: any) {
      Alert.alert("Sync Error", err?.message || "Unable to reach server.");
    } finally {
      setIsSyncingQueue(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of your HyperGrid account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              router.replace("/(auth)");
            } catch (e) {
              console.warn("[ProfileScreen] Logout error:", e);
              router.replace("/(auth)");
            }
          },
        },
      ]
    );
  }, [router, signOut]);

  const showSkeleton = !user && isAuthLoading;

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.canvas }}
      edges={["top"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pt-3 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar: Profile Heading + Quick Menu Button */}
        <View className="flex-row items-center justify-between pt-1">
          <Text
            className="font-inter-extrabold text-[28px] tracking-tight"
            style={{ color: colors.text }}
          >
            Profile
          </Text>

          <TouchableOpacity
            onPress={() => setActiveModal("menu")}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="More profile actions"
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <MoreHorizontal size={19} color={colors.text} />
          </TouchableOpacity>
        </View>

        {showSkeleton ? (
          <ProfileContentSkeleton />
        ) : (
          <View className="gap-4">
            {/* Compact Account Card */}
            <ProfileHeader
              userName={user?.name}
              userEmail={user?.email}
              userImage={user?.image}
              onImageUpdated={async (newImage) => {
                await updateProfile({ image: newImage });
              }}
              onEditProfile={handleOpenEdit}
            />

            {/* Grouped Card 1: Telemetry & Safety */}
            <View
              className="rounded-[20px] border overflow-hidden"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <ProfileMenuRow
                icon={<CarFront size={18} color={colors.brand} />}
                title="Vehicle"
                subtitle={vehicleProfile.name}
                onPress={() => setActiveModal("calibration")}
                showDivider
              />

              <ProfileMenuRow
                icon={<CloudUpload size={18} color={colors.brand} />}
                title="Cloud Sync"
                subtitle={
                  pendingQueueCount > 0
                    ? `${pendingQueueCount} pending`
                    : `${syncedTripsCount} synced`
                }
                onPress={() => {
                  refreshSyncMetrics();
                  setActiveModal("sync");
                }}
                showDivider
              />

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
                  trackColor={{
                    false: colors.borderStrong,
                    true: colors.brand,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <ProfileMenuRow
                icon={<PhoneCall size={18} color={colors.danger} />}
                title="Emergency SOS"
                onPress={() => setIsEmergencyVisible(true)}
                showDivider={false}
              />
            </View>

            {/* Grouped Card 2: App Info */}
            <View
              className="rounded-[20px] border overflow-hidden"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <ProfileMenuRow
                icon={<Cpu size={18} color={colors.brand} />}
                title="How It Works"
                onPress={() => setActiveModal("guide")}
                showDivider
              />
              <ProfileMenuRow
                icon={<ShieldCheck size={18} color={colors.brand} />}
                title="Privacy Policy"
                onPress={() => setActiveModal("privacy")}
                showDivider
              />
              <ProfileMenuRow
                icon={<FileText size={18} color={colors.brand} />}
                title="Terms & Conditions"
                onPress={() => setActiveModal("terms")}
                showDivider={false}
              />
            </View>

            {/* Driver & Sensor Details */}
            <PersonalInfoList onEdit={handleOpenEdit} user={user as any} />

            {/* Log out Card */}
            <LogoutButton onPress={handleLogout} />
          </View>
        )}
      </ScrollView>

      {/* Edit Personal Info Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.overlay }}
        >
          <View
            className="rounded-t-sheet p-6 border-t shadow-lg"
            style={{
              backgroundColor: colors.sheet,
              borderTopColor: colors.border,
            }}
          >
            <View
              className="mb-4 flex-row items-center justify-between pb-3 border-b"
              style={{ borderBottomColor: colors.border }}
            >
              <View className="flex-row items-center gap-2">
                <Edit3 size={19} color={colors.brand} />
                <Text
                  className="font-inter-extrabold text-lg"
                  style={{ color: colors.text }}
                >
                  Edit Personal Information
                </Text>
              </View>
              <Touchable
                onPress={() => setEditModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close edit modal"
              >
                <View
                  className="rounded-full p-2"
                  style={{ backgroundColor: colors.subtle }}
                >
                  <X size={16} color={colors.textMuted} />
                </View>
              </Touchable>
            </View>

            <View className="gap-4">
              <View className="gap-1.5">
                <Text
                  className="font-inter-semibold text-xs"
                  style={{ color: colors.textMuted }}
                >
                  Name
                </Text>
                <TextInput
                  autoCapitalize="words"
                  className="rounded-xl border px-4 py-3 font-inter text-sm"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  placeholder="Full Name"
                  placeholderTextColor={colors.textMuted}
                  value={nameInput}
                  onChangeText={setNameInput}
                />
              </View>

              <View className="gap-1.5">
                <Text
                  className="font-inter-semibold text-xs"
                  style={{ color: colors.textMuted }}
                >
                  Phone Number
                </Text>
                <TextInput
                  className="rounded-xl border px-4 py-3 font-inter text-sm"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  keyboardType="phone-pad"
                  placeholder="+62 812-3456-7890"
                  placeholderTextColor={colors.textMuted}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                />
              </View>

              <View className="gap-1.5">
                <Text
                  className="font-inter-semibold text-xs"
                  style={{ color: colors.textMuted }}
                >
                  Account Email (Registered)
                </Text>
                <View
                  className="rounded-xl border px-4 py-3"
                  style={{
                    backgroundColor: colors.subtle,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    className="font-inter text-sm"
                    style={{ color: colors.textMuted }}
                  >
                    {user?.email || "driver@hypergrid.io"}
                  </Text>
                </View>
              </View>

              <View className="mt-2">
                <AppButton
                  variant="primary"
                  size="lg"
                  label="Save Profile Changes"
                  loading={isSaving}
                  iconLeft={<Check size={18} color="#FFFFFF" />}
                  onPress={handleSaveProfile}
                  accessibilityLabel="Save Profile Changes"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feature & Info Modals */}
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
            <View className="flex-row items-center justify-between mb-3.5">
              <Text
                className="font-inter-extrabold text-lg"
                style={{ color: colors.text }}
              >
                {activeModal === "calibration"
                  ? "Vehicle"
                  : activeModal === "sync"
                    ? "Cloud Sync"
                    : activeModal === "guide"
                      ? "How It Works"
                      : activeModal === "privacy"
                        ? "Privacy Policy"
                        : activeModal === "terms"
                          ? "Terms & Conditions"
                          : "Menu"}
              </Text>
              <TouchableOpacity
                onPress={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.subtle }}
              >
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {activeModal === "calibration" ? (
              <View className="gap-2.5">
                <Text
                  className="font-inter text-xs mb-1"
                  style={{ color: colors.textMuted }}
                >
                  Select your vehicle type to tune on-device accelerometer and
                  gyroscope shock thresholds:
                </Text>
                {VEHICLE_ORDER.map((id) => {
                  const profile = VEHICLE_PROFILES[id];
                  const selected = id === vehicleId;
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => setVehicle(id)}
                      activeOpacity={0.8}
                      className="flex-row items-center justify-between p-3.5 rounded-2xl border"
                      style={{
                        backgroundColor: selected
                          ? colors.brandSoft
                          : colors.cardMuted,
                        borderColor: selected
                          ? colors.brand
                          : colors.border,
                      }}
                    >
                      <View className="flex-1 pr-2">
                        <Text
                          className="font-inter-bold text-sm"
                          style={{
                            color: selected ? colors.brandText : colors.text,
                          }}
                        >
                          {profile.name}
                        </Text>
                        <Text
                          className="font-mono text-[11px] mt-0.5"
                          style={{ color: colors.textMuted }}
                        >
                          Shock {profile.sensorConfig.zShockThreshold.toFixed(2)}G
                          {" | "}Min {profile.sensorConfig.minMovingSpeed} km/h
                        </Text>
                      </View>
                      {selected ? (
                        <Check size={18} color={colors.brand} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : activeModal === "sync" ? (
              <View className="gap-3">
                <View
                  className="rounded-2xl border p-3.5 gap-2"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row justify-between items-center">
                    <Text
                      className="font-inter text-xs"
                      style={{ color: colors.textMuted }}
                    >
                      Offline Detection Queue
                    </Text>
                    <Text
                      className="font-mono-bold text-xs"
                      style={{ color: colors.text }}
                    >
                      {pendingQueueCount} pending
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text
                      className="font-inter text-xs"
                      style={{ color: colors.textMuted }}
                    >
                      Saved Trip Sessions
                    </Text>
                    <Text
                      className="font-mono-bold text-xs"
                      style={{ color: colors.text }}
                    >
                      {syncedTripsCount} trips
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text
                      className="font-inter text-xs"
                      style={{ color: colors.textMuted }}
                    >
                      Backend Endpoint
                    </Text>
                    <Text
                      className="font-mono text-[11px] max-w-[180px]"
                      style={{ color: colors.brandText }}
                      numberOfLines={1}
                    >
                      {getApiBaseUrl()}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleFlushQueue}
                  disabled={isSyncingQueue}
                  activeOpacity={0.85}
                  className="flex-row items-center justify-center gap-2 py-3 rounded-xl border"
                  style={{
                    backgroundColor: isDark ? colors.subtle : colors.brandSoft,
                    borderColor: colors.brandBorder,
                  }}
                >
                  {isSyncingQueue ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : (
                    <RefreshCw size={15} color={colors.brand} />
                  )}
                  <Text
                    className="font-inter-bold text-xs"
                    style={{ color: colors.brandText }}
                  >
                    Sync Now
                  </Text>
                </TouchableOpacity>
              </View>
            ) : activeModal === "guide" ? (
              <View className="gap-2.5">
                <Text
                  className="font-inter text-[13px] leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  1. Mount your phone securely before starting a ride.
                </Text>
                <Text
                  className="font-inter text-[13px] leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  2. Motion sensors watch for sharp bumps while moving.
                </Text>
                <Text
                  className="font-inter text-[13px] leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  3. Confirmed hazards appear on the road map for other drivers.
                </Text>
              </View>
            ) : activeModal === "privacy" ? (
              <View className="gap-2.5">
                <Text
                  className="font-inter text-[13px] leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  Sensor readings stay on your device. Only confirmed hazard
                  locations, speed, vehicle type, and shock strength are shared.
                </Text>
              </View>
            ) : activeModal === "terms" ? (
              <View className="gap-2.5">
                <Text
                  className="font-inter text-[13px] leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  HyperGrid provides road hazard alerts to assist drivers. Keep
                  your eyes on the road and mount your phone safely.
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                <TouchableOpacity
                  onPress={() => {
                    setActiveModal(null);
                    router.push("/(tabs)/settings");
                  }}
                  activeOpacity={0.75}
                  className="flex-row items-center gap-3 p-3.5 rounded-2xl border"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  }}
                >
                  <Settings size={17} color={colors.brand} />
                  <Text
                    className="font-inter-semibold text-sm flex-1"
                    style={{ color: colors.text }}
                  >
                    App Settings
                  </Text>
                  <ChevronRight size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setActiveModal(null);
                    handleOpenEdit();
                  }}
                  activeOpacity={0.75}
                  className="flex-row items-center gap-3 p-3.5 rounded-2xl border"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  }}
                >
                  <Edit3 size={17} color={colors.brand} />
                  <Text
                    className="font-inter-semibold text-sm flex-1"
                    style={{ color: colors.text }}
                  >
                    Edit Profile
                  </Text>
                  <ChevronRight size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    refreshSyncMetrics();
                    setActiveModal("sync");
                  }}
                  activeOpacity={0.75}
                  className="flex-row items-center gap-3 p-3.5 rounded-2xl border"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  }}
                >
                  <Activity size={17} color={colors.brand} />
                  <Text
                    className="font-inter-semibold text-sm flex-1"
                    style={{ color: colors.text }}
                  >
                    Sync Status
                  </Text>
                  <ChevronRight size={16} color={colors.textMuted} />
                </TouchableOpacity>
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

      {/* Emergency Center Modal */}
      <EmergencyModal
        visible={isEmergencyVisible}
        onClose={() => setIsEmergencyVisible(false)}
        currentCoords={coords}
        speedKmh={0}
      />
    </SafeAreaView>
  );
}

const ProfileMenuRow = React.memo(function ProfileMenuRow({
  icon,
  title,
  subtitle,
  onPress,
  showDivider,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showDivider: boolean;
}) {
  const { colors } = useOptionalThemeCompat();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className={
        showDivider
          ? "flex-row items-center justify-between px-4 py-3.5 border-b"
          : "flex-row items-center justify-between px-4 py-3.5"
      }
      style={showDivider ? { borderBottomColor: colors.border } : undefined}
    >
      <View className="flex-row items-center gap-3 flex-1 pr-3">
        <View
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ backgroundColor: colors.subtle }}
        >
          {icon}
        </View>
        <View className="flex-1">
          <Text
            className="font-inter-semibold text-[15px]"
            style={{ color: colors.text }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              className="font-inter text-xs mt-0.5"
              style={{ color: colors.textMuted }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
});

function useOptionalThemeCompat() {
  return useAppTheme();
}
