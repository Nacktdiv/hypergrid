import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

import { Touchable } from "@/components/ui/touchable";
import { PROFILE } from "./mock-data";

export interface ProfileHeaderProps {
  userName?: string;
  userImage?: string | null;
  onImageUpdated?: (imageUri: string) => Promise<void> | void;
  onEditPhoto?: () => void;
}

/**
 * Top Profile Header dengan pemilihan & persistensi avatar pengguna.
 * Figma #114:1311 (judul "Profile", centered) + #114:1312 (avatar 112px + tombol kamera 32px).
 */
export function ProfileHeader({
  userName,
  userImage,
  onImageUpdated,
  onEditPhoto,
}: ProfileHeaderProps) {
  const [isUploading, setIsUploading] = useState(false);

  const processImageResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const dataUri = asset.base64
      ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
      : asset.uri;

    setIsUploading(true);
    try {
      if (onImageUpdated) {
        await onImageUpdated(dataUri);
      }
    } catch (err: any) {
      Alert.alert(
        "Gagal Menyimpan Foto",
        err.message || "Terjadi kesalahan saat mengunggah foto profil.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Izin Kamera Diperlukan",
          "HyperGrid membutuhkan izin kamera untuk mengambil foto profil.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      await processImageResult(result);
    } catch (err) {
      console.warn("[ProfileHeader] Gagal membuka kamera:", err);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Izin Galeri Diperlukan",
          "HyperGrid membutuhkan izin galeri untuk memilih foto profil.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      await processImageResult(result);
    } catch (err) {
      console.warn("[ProfileHeader] Gagal membuka galeri:", err);
    }
  };

  const handlePressCamera = () => {
    onEditPhoto?.();

    Alert.alert(
      "Ubah Foto Profil",
      "Pilih sumber foto profil Anda:",
      [
        {
          text: "Ambil Foto (Kamera)",
          onPress: handlePickFromCamera,
        },
        {
          text: "Pilih dari Galeri",
          onPress: handlePickFromGallery,
        },
        {
          text: "Batal",
          style: "cancel",
        },
      ],
      { cancelable: true },
    );
  };

  const avatarSource = userImage ? { uri: userImage } : PROFILE.avatar;

  return (
    <View className="items-center gap-4">
      <Text className="text-center font-chivo-bold text-xl text-black">
        Profile
      </Text>

      <View className="h-28 w-28">
        {/* Avatar 112px + stroke putih 3px — Figma #114:1314 */}
        <View
          className="h-full w-full overflow-hidden rounded-full border-[3px] border-white bg-slate-100"
          style={{
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
          }}
        >
          <Image
            source={avatarSource}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
          />

          {isUploading ? (
            <View className="absolute inset-0 items-center justify-center bg-black/40">
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : null}
        </View>

        {/* Tombol kamera 32px di kanan-bawah avatar — Figma #114:1316 */}
        <Touchable
          accessibilityLabel="Change profile photo"
          accessibilityRole="button"
          className="absolute -bottom-1 -right-1"
          onPress={handlePressCamera}
          disabled={isUploading}
        >
          <View
            className="h-8 w-8 items-center justify-center rounded-full border border-[#F3F4F6] bg-white shadow-sm"
            style={{
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
            }}
          >
            <Camera size={14} color="#0040FF" />
          </View>
        </Touchable>
      </View>

      {userName ? (
        <Text className="font-chivo-bold text-lg text-custom-black">
          {userName}
        </Text>
      ) : null}
    </View>
  );
}
