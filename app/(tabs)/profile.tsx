import { Alert, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LogoutButton } from "@/components/profile/logout-button";
import { PersonalInfoList } from "@/components/profile/personal-info-list";
import { ProfileHeader } from "@/components/profile/profile-header";
import { SelectedVehicleCard } from "@/components/profile/selected-vehicle-card";

/**
 * Screen 9 — Profile.
 * Referensi desain: Figma "Final Page Mobile" → frame `Profile` #114:1309.
 *
 * Interaktif: tombol kamera profil dan Log Out menampilkan `Alert`
 * konfirmasi — belum ada navigasi maupun API.
 * TODO: ganti dengan navigasi/session management saat Tahap 2.
 *
 * Bottom navigation ditangani oleh `app/(tabs)/_layout.tsx`.
 */
export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-custom-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader onEditPhoto={() => Alert.alert("Ganti Foto Profil", "Fitur ini belum tersedia pada tahap UI.")} />

        {/* Info Cards Container — Figma #114:1319 */}
        <View className="gap-4 px-1 pt-2">
          <SelectedVehicleCard />
          <PersonalInfoList />
          <LogoutButton
            onPress={() =>
              Alert.alert(
                "Log Out",
                "Anda akan keluar dari akun HyperGrid.\n\nTODO: session management saat Tahap 2.",
                [
                  { text: "Batal", style: "cancel" },
                  { text: "Keluar", style: "destructive" },
                ]
              )
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
