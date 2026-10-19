import { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Edit3, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LogoutButton } from "@/components/profile/logout-button";
import { PersonalInfoList } from "@/components/profile/personal-info-list";
import { ProfileHeader } from "@/components/profile/profile-header";
import { SelectedVehicleCard } from "@/components/profile/selected-vehicle-card";
import { AppButton } from "@/components/ui/app-button";
import { Touchable } from "@/components/ui/touchable";
import { useAuth } from "@/hooks/use-auth";

/**
 * Screen 9 — Profile (Terintegrasi Penuh dengan Better-Auth & Fitur Edit Info).
 *
 * Mendukung:
 *   - Edit informasi profil pribadi (Nama, Telepon, ID Petugas)
 *   - Persistensi data profil lokal via TokenStorage
 *   - Sign out terenkripsi dari sesi Better-Auth
 */
export default function ProfileScreen() {
  const { user, signOut, updateProfile } = useAuth();

  // State Modal Edit Profil
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "Budi Santoso");
  const [phoneInput, setPhoneInput] = useState(
    (user as any)?.phone || "+62 812-3456-7890"
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenEdit = () => {
    setNameInput(user?.name || "Budi Santoso");
    setPhoneInput((user as any)?.phone || "+62 812-3456-7890");
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
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
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of HyperGrid account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
            } catch (e) {
              console.warn("[ProfileScreen] Logout error:", e);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pt-2 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          userName={user?.name}
          onEditPhoto={() =>
            Alert.alert(
              "Profile Photo",
              "Active avatar is linked to your account."
            )
          }
        />

        {/* Info Cards Container */}
        <View className="gap-3.5 pt-1">
          <SelectedVehicleCard />
          <PersonalInfoList
            onEdit={handleOpenEdit}
            user={user as any}
          />
          <LogoutButton onPress={handleLogout} />
        </View>
      </ScrollView>

      {/* MODAL EDIT PERSONAL INFO */}
      <Modal
        animationType="slide"
        transparent
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-sheet bg-white p-6 border-t border-slate-200/80 shadow-lg">
            <View className="mb-4 flex-row items-center justify-between pb-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <Edit3 size={20} color="#009EFF" />
                <Text className="font-chivo-bold text-xl text-slate-900">
                  Edit Personal Information
                </Text>
              </View>
              <Touchable
                onPress={() => setEditModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close edit modal"
              >
                <View className="rounded-full bg-slate-100 p-1.5">
                  <X size={18} color="#64748B" />
                </View>
              </Touchable>
            </View>

            <View className="gap-4">
              <View className="gap-1.5">
                <Text className="font-quicksand-semibold text-xs text-slate-500">
                  Name
                </Text>
                <TextInput
                  autoCapitalize="words"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-quicksand text-sm text-slate-900"
                  placeholder="Full Name"
                  value={nameInput}
                  onChangeText={setNameInput}
                />
              </View>

              <View className="gap-1.5">
                <Text className="font-quicksand-semibold text-xs text-slate-500">
                  Phone Number
                </Text>
                <TextInput
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-quicksand text-sm text-slate-900"
                  keyboardType="phone-pad"
                  placeholder="+62 812-3456-7890"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                />
              </View>

              <View className="gap-1.5">
                <Text className="font-quicksand-semibold text-xs text-slate-500">
                  Account Email (Registered)
                </Text>
                <View className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3">
                  <Text className="font-quicksand text-sm text-slate-500">
                    {user?.email || "user@hypergrid.io"}
                  </Text>
                </View>
              </View>

              <View className="mt-2">
                <AppButton
                  variant="primary"
                  size="md"
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
    </SafeAreaView>
  );
}
