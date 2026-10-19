import React from "react";
import { Text, View } from "react-native";
import { IdCard, Mail, Phone, Radio, type LucideIcon } from "lucide-react-native";

import { AppCard } from "@/components/ui/app-card";
import { Touchable } from "@/components/ui/touchable";
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

export function PersonalInfoList({
  user,
  onEdit,
}: {
  user?: ExtendedUserProfile | null;
  onEdit?: () => void;
} = {}) {
  const displayFields = PERSONAL_INFO.map((field) => {
    if (user) {
      if (field.id === "email" && user.email) {
        return { ...field, value: user.email };
      }
      if (field.id === "driver" && (user.name || user.id)) {
        return { ...field, value: `${user.name} (${user.id.substring(0, 10)})` };
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
    <AppCard variant="default" className="gap-4 p-4">
      <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
        <Text className="font-quicksand-bold text-base text-slate-900">
          Personal Information
        </Text>

        <Touchable
          accessibilityLabel="Edit personal information"
          accessibilityRole="button"
          onPress={onEdit}
          scaleTo={0.92}
        >
          <View className="rounded-full bg-sky-50 px-3 py-1">
            <Text className="font-quicksand-bold text-xs text-brand">
              Edit
            </Text>
          </View>
        </Touchable>
      </View>

      <View className="gap-3.5">
        {displayFields.map((field) => (
          <InfoRow key={field.id} field={field} />
        ))}
      </View>
    </AppCard>
  );
}

function InfoRow({ field }: { field: PersonalInfoField }) {
  const Icon = ICONS[field.icon];

  return (
    <View className="flex-row items-center gap-3.5">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/70">
        <Icon size={18} color="#64748B" />
      </View>

      <View className="flex-1">
        <Text className="font-quicksand-semibold text-xs text-slate-600">
          {field.label}
        </Text>
        <Text className="font-quicksand-bold text-sm text-slate-900 mt-0.5">
          {field.value}
        </Text>
      </View>
    </View>
  );
}
