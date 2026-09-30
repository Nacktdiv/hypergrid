import { useState } from "react";
import { Text, View } from "react-native";
import { Camera } from "lucide-react-native";
import { Image } from "expo-image";

import { Touchable } from "@/components/ui/touchable";

import { PROFILE } from "./mock-data";

/**
 * Top Profile Header.
 * Figma #114:1311 (judul "Profile", centered) + #114:1312 (avatar 112px + tombol kamera 32px).
 *
 * Interaktif: tombol kamera bisa ditekan (belum ada galeri/native picker).
 */
export function ProfileHeader({ onEditPhoto }: { onEditPhoto?: () => void }) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <View className="items-center gap-6">
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
            source={PROFILE.avatar}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
          />
        </View>

        {/* Tombol kamera 32px di kanan-bawah avatar — Figma #114:1316 */}
        <Touchable
          accessibilityLabel="Ganti foto profil"
          accessibilityRole="button"
          className="absolute -bottom-1 -right-1"
          onPress={() => {
            setIsEditing((value) => !value)
            onEditPhoto?.()
          }}
        >
          <View
            className={`h-8 w-8 items-center justify-center rounded-full border bg-white ${
              isEditing ? "border-custom-primary" : "border-[#F3F4F6]"
            }`}
            style={{
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
            }}
          >
            <Camera size={14} color={isEditing ? "#009EFF" : "#1C1C1E"} />
          </View>
        </Touchable>
      </View>
    </View>
  )
}
