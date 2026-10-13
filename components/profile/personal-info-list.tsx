import { Text, View } from "react-native";
import { IdCard, Mail, Phone, Radio, type LucideIcon } from "lucide-react-native";

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

/**
 * Personal Info List — group list card.
 * Menampilkan data profil petugas dari Better-Auth saat tersedia.
 */
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
    <View className="gap-5 rounded-3xl border border-[#E2E2E2] bg-white p-5">
      <View className="flex-row items-center justify-between">
        <Text className="font-quicksand-bold text-lg text-[#1C1C1E]">
          Personal info
        </Text>

        <Touchable
          accessibilityLabel="Edit informasi pribadi"
          accessibilityRole="button"
          onPress={onEdit}
          scaleTo={0.9}
        >
          <View className="rounded-full bg-slate-100 px-3.5 py-1.5">
            <Text className="font-quicksand-bold text-xs text-custom-primary">
              Edit
            </Text>
          </View>
        </Touchable>
      </View>

      <View className="gap-5">
        {displayFields.map((field) => (
          <InfoRow key={field.id} field={field} />
        ))}
      </View>
    </View>
  );
}

function InfoRow({ field }: { field: PersonalInfoField }) {
  const Icon = ICONS[field.icon];

  return (
    <View className="flex-row items-center gap-4">
      <Icon size={20} color="#64748B" />

      <View className="flex-1 gap-0.5">
        <Text className="font-quicksand-semibold text-xs text-[#64748B]">
          {field.label}
        </Text>
        <Text className="font-quicksand-semibold text-sm text-custom-black">
          {field.value}
        </Text>
      </View>
    </View>
  );
}
