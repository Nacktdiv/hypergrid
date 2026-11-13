import React from "react";
import { Text, View } from "react-native";
import {
  IdCard,
  Mail,
  Phone,
  Radio,
  type LucideIcon,
} from "lucide-react-native";

import { AppCard } from "@/components/ui/app-card";
import { Touchable } from "@/components/ui/touchable";
import { useOptionalTheme } from "@/contexts/theme-context";
import type { AuthUser } from "@/types/api";

import { PERSONAL_INFO, type PersonalInfoField } from "./mock-data";

const ICONS: Record<PersonalInfoField["icon"], LucideIcon> = {
  email: Mail,
  phone: Phone,
  driver: IdCard,
  sensor: Radio,
};

export type ExtendedUserProfile = AuthUser & {
  phone?: string;
  vehiclePlate?: string;
};

export const PersonalInfoList = React.memo(function PersonalInfoList({
  user,
  onEdit,
}: {
  user?: ExtendedUserProfile | null;
  onEdit?: () => void;
}) {
  const { colors } = useOptionalTheme();

  const displayFields = PERSONAL_INFO.map((field) => {
    if (user) {
      if (field.id === "email" && user.email) {
        return { ...field, value: user.email };
      }
      if (field.id === "driver" && (user.name || user.id)) {
        return {
          ...field,
          value: `${user.name} (${user.id.substring(0, 10)})`,
        };
      }
      if (field.id === "phone" && user.phone) {
        return { ...field, value: user.phone };
      }
      if (field.id === "sensor") {
        return { ...field, value: "HyperGrid Edge v1.0 (Online)" };
      }
    }
    return field;
  });

  return (
    <AppCard
      variant="default"
      className="gap-4 p-4"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <View
        className="flex-row items-center justify-between pb-2.5 border-b"
        style={{ borderBottomColor: colors.border }}
      >
        <Text
          className="font-inter-bold text-base"
          style={{ color: colors.text }}
        >
          Personal Information
        </Text>

        {onEdit ? (
          <Touchable
            accessibilityLabel="Edit personal information"
            accessibilityRole="button"
            onPress={onEdit}
            scaleTo={0.92}
          >
            <View
              className="rounded-full px-3 py-1 border"
              style={{
                backgroundColor: colors.brandSoft,
                borderColor: colors.brandBorder,
              }}
            >
              <Text
                className="font-inter-bold text-xs"
                style={{ color: colors.brandText }}
              >
                Edit
              </Text>
            </View>
          </Touchable>
        ) : null}
      </View>

      <View className="gap-3.5">
        {displayFields.map((field) => (
          <InfoRow key={field.id} field={field} />
        ))}
      </View>
    </AppCard>
  );
});

function InfoRow({ field }: { field: PersonalInfoField }) {
  const { colors } = useOptionalTheme();
  const Icon = ICONS[field.icon];

  return (
    <View className="flex-row items-center gap-3.5">
      <View
        className="h-9 w-9 items-center justify-center rounded-xl border"
        style={{
          backgroundColor: colors.subtle,
          borderColor: colors.border,
        }}
      >
        <Icon size={17} color={colors.brand} />
      </View>

      <View className="flex-1">
        <Text
          className="font-inter-medium text-xs"
          style={{ color: colors.textMuted }}
        >
          {field.label}
        </Text>
        <Text
          className="font-inter-semibold text-sm mt-0.5"
          style={{ color: colors.text }}
        >
          {field.value}
        </Text>
      </View>
    </View>
  );
}
