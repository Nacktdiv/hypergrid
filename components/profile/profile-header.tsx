import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, Pencil } from "lucide-react-native";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

import { Touchable } from "@/components/ui/touchable";
import { useOptionalTheme } from "@/contexts/theme-context";
import { PROFILE } from "./mock-data";

export interface ProfileHeaderProps {
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
  onImageUpdated?: (imageUri: string) => Promise<void> | void;
  onEditPhoto?: () => void;
  onEditProfile?: () => void;
}

/**
 * Compact User Account Identity Card matching Light/Dark design system.
 */
export const ProfileHeader = React.memo(function ProfileHeader({
  userName,
  userEmail,
  userImage,
  onImageUpdated,
  onEditPhoto,
  onEditProfile,
}: ProfileHeaderProps) {
  const { colors } = useOptionalTheme();
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
        "Photo Save Failed",
        err.message || "Unable to upload profile photo."
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
          "Camera Permission Required",
          "HyperGrid needs camera access to take a profile photo."
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
      console.warn("[ProfileHeader] Camera error:", err);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Gallery Permission Required",
          "HyperGrid needs photo library access to select a profile photo."
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
      console.warn("[ProfileHeader] Gallery error:", err);
    }
  };

  const handlePressCamera = () => {
    onEditPhoto?.();

    Alert.alert(
      "Update Profile Photo",
      "Choose a photo source:",
      [
        {
          text: "Take Photo (Camera)",
          onPress: handlePickFromCamera,
        },
        {
          text: "Choose from Library",
          onPress: handlePickFromGallery,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true }
    );
  };

  const avatarSource = userImage ? { uri: userImage } : PROFILE.avatar;

  return (
    <View
      className="flex-row items-center rounded-[20px] border p-4"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      {/* Avatar with quick photo edit badge */}
      <Touchable
        accessibilityLabel="Change profile photo"
        accessibilityRole="button"
        onPress={handlePressCamera}
        disabled={isUploading}
        scaleTo={0.95}
      >
        <View className="h-14 w-14 relative">
          <View
            className="h-full w-full overflow-hidden rounded-full border-2"
            style={{
              borderColor: colors.brandBorder,
              backgroundColor: colors.subtle,
            }}
          >
            <Image
              source={avatarSource}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={200}
            />
            {isUploading ? (
              <View className="absolute inset-0 items-center justify-center bg-black/45">
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : null}
          </View>

          <View
            className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full border"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <Camera size={11} color={colors.brand} />
          </View>
        </View>
      </Touchable>

      {/* Account Name & Email */}
      <View className="flex-1 mx-3.5">
        <Text
          className="font-inter-bold text-base"
          style={{ color: colors.text }}
          numberOfLines={1}
        >
          {userName || "HyperGrid Driver"}
        </Text>
        <Text
          className="font-inter text-xs mt-0.5"
          style={{ color: colors.textMuted }}
          numberOfLines={1}
        >
          {userEmail || "driver@hypergrid.io"}
        </Text>
      </View>

      {/* Edit Profile Pen Button */}
      {onEditProfile ? (
        <Touchable
          accessibilityLabel="Edit profile details"
          accessibilityRole="button"
          onPress={onEditProfile}
          scaleTo={0.92}
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: colors.subtle,
              borderColor: colors.border,
            }}
          >
            <Pencil size={16} color={colors.textSecondary} />
          </View>
        </Touchable>
      ) : null}
    </View>
  );
});
