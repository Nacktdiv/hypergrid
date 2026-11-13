import React from "react";
import { LogOut } from "lucide-react-native";
import { Text, TouchableOpacity, View } from "react-native";

import { useOptionalTheme } from "@/contexts/theme-context";

export const LogoutButton = React.memo(function LogoutButton({
  onPress,
}: {
  onPress: () => void;
}) {
  const { colors } = useOptionalTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Log Out of HyperGrid"
      className="flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center"
        style={{ backgroundColor: colors.dangerSoft }}
      >
        <LogOut size={18} color={colors.danger} />
      </View>
      <Text
        className="font-inter-bold text-[15px]"
        style={{ color: colors.dangerText }}
      >
        Log out
      </Text>
    </TouchableOpacity>
  );
});
