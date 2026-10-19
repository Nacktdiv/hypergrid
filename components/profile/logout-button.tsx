import React from "react";
import { LogOut } from "lucide-react-native";

import { AppButton } from "@/components/ui/app-button";

export function LogoutButton({ onPress }: { onPress: () => void }) {
  return (
    <AppButton
      variant="destructive"
      size="md"
      label="Log Out of HyperGrid"
      iconLeft={<LogOut size={18} color="#EF4444" />}
      onPress={onPress}
      accessibilityLabel="Log Out"
    />
  );
}
