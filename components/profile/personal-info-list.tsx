import { Text, View } from "react-native";
import { IdCard, Mail, Phone, Radio, type LucideIcon } from "lucide-react-native";

import { Touchable } from "@/components/ui/touchable";

import { PERSONAL_INFO, type PersonalInfoField } from "./mock-data";

const ICONS: Record<PersonalInfoField["icon"], LucideIcon> = {
  email: Mail,
  phone: Phone,
  driver: IdCard,
  sensor: Radio,
}

/**
 * Personal Info List — group list card.
 * Figma #114:1325 "Article - Personal Info Card": header dengan judul
 * + tombol "Edit" di kanan, lalu baris ikon(20) / label / value dengan gap 20.
 *
 * Interaktif: tombol Edit menampilkan alert placeholder.
 */
export function PersonalInfoList() {
  return (
    <View className="gap-5 rounded-3xl border border-[#E2E2E2] bg-white p-5">
      <View className="flex-row items-center justify-between">
        <Text className="font-quicksand-bold text-lg text-[#1C1C1E]">
          Personal info
        </Text>

        <Touchable
          accessibilityLabel="Edit informasi pribadi"
          accessibilityRole="button"
          scaleTo={0.9}
        >
          <View className="rounded-full px-3 py-1">
            <Text className="font-quicksand-semibold text-sm text-[#1C1C1E]">
              Edit
            </Text>
          </View>
        </Touchable>
      </View>

      <View className="gap-5">
        {PERSONAL_INFO.map((field) => (
          <InfoRow key={field.id} field={field} />
        ))}
      </View>
    </View>
  )
}

function InfoRow({ field }: { field: PersonalInfoField }) {
  const Icon = ICONS[field.icon]

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
  )
}
