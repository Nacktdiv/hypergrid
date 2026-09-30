import { Image } from "expo-image";
import { Text, View } from "react-native";

import { cn } from "@/lib/utils";
import { Touchable } from "@/components/ui/touchable";

import { VEHICLE_OPTIONS, type VehicleId } from "./mock-data";

/**
 * Selector kendaraan — Figma `Vechile` #114:1280.
 *
 * Tinggi 64, radius 16, tiga opsi equal.
 * Aktif: isi custom.active (#BAD3F5) + border 2px custom.primary (#009EFF).
 * Non-aktif: isi custom.disabled (#E9EAEC) + border 2px custom.borderDisabled.
 *
 * State terpilih dimiliki screen; komponen ini murni presentasi.
 */
export function VehicleSelector({
  selected,
  onSelect,
}: {
  selected: VehicleId
  onSelect: (id: VehicleId) => void
}) {
  return (
    <View className="flex-row justify-center items-center gap-2.5">
      {VEHICLE_OPTIONS.map((option) => (
        <VehicleCard
          key={option.id}
          id={option.id}
          image={option.image}
          isActive={selected === option.id}
          label={option.label}
          onSelect={onSelect}
        />
      ))}
    </View>
  )
}

type VehicleCardProps = {
  id: VehicleId
  label: string
  image: number
  isActive: boolean
  onSelect: (id: VehicleId) => void
}

function VehicleCard({ id, label, image, isActive, onSelect }: VehicleCardProps) {
  return (
    <View
      className={cn(
        "w-full flex flex-1 rounded-2xl border-2 items-center justify-center py-3 px-2 overflow-hidden",
        isActive
            ? "border-custom-primary bg-custom-active"
            : "border-custom-borderDisabled bg-custom-disabled"
      )}
    >
      <Touchable
        className={cn(
          "flex-1",
        )}
        onPress={() => onSelect(id)}
        scaleTo={0.94}
        accessibilityLabel={label}
        accessibilityRole="radio"
        accessibilityState={{ selected: isActive }}
      >
        <View
          className={cn(
            "w-full flex flex-col items-center justify-center gap-1",
          )}
        >
          <Image
            source={image}
            style={{ height: 28, width: 48 }}
            contentFit="contain"
            transition={200}
          />
          <Text
            className={cn(
              "font-chivo-bold text-sm text-center",
              isActive ? "text-custom-primary" : "text-slate-500"
            )}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </Touchable>
    </View>
  )
}
