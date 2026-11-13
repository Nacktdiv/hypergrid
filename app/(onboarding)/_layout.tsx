import { useState, useEffect, createContext } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";
import { Slot, useRouter } from "expo-router";

import { useAppTheme } from "@/contexts/theme-context";
import { useAuth } from "@/hooks/use-auth";

export type OnboardingContextType = {
  progress: number;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
};

export const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined
);

export default function RootLayout() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { completeOnboarding } = useAuth();

  const [percentage, setPercentage] = useState<number>(33.3);
  const [progress, setProgress] = useState<number>(1);

  useEffect(() => {
    const constant = 100 / 3;
    const timer = setTimeout(() => setPercentage(constant * progress), 120);
    return () => clearTimeout(timer);
  }, [progress]);

  const handleFinish = async () => {
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <OnboardingContext.Provider value={{ progress, setProgress }}>
      <SafeAreaView
        className="relative flex-1 items-center justify-center px-5 pb-8"
        style={{ backgroundColor: colors.canvas }}
      >
        <View className="w-full h-16 flex-row items-center justify-between py-3 z-10">
          <View className="flex-row items-center gap-2.5">
            <Image
              source={require("@/assets/images/iconH.png")}
              style={{ width: 32, height: 32 }}
              resizeMode="contain"
            />
            <Text
              className="text-xl font-inter-extrabold tracking-tight"
              style={{ color: colors.text }}
            >
              HYPERGRID
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleFinish}
            activeOpacity={0.75}
            className="px-3.5 py-1.5 rounded-full border"
            style={{
              backgroundColor: colors.subtle,
              borderColor: colors.border,
            }}
          >
            <Text
              className="text-sm font-inter-bold"
              style={{ color: colors.textSecondary }}
            >
              Skip
            </Text>
          </TouchableOpacity>
        </View>

        <View
          className="w-full h-2 rounded-full overflow-hidden mt-2"
          style={{ backgroundColor: colors.subtle }}
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(10, percentage))}%`,
              backgroundColor: colors.brand,
            }}
          />
        </View>

        <View className="flex-1 w-full items-center justify-center gap-5">
          <Slot />
        </View>

        <TouchableOpacity
          onPress={() => {
            if (progress < 3) {
              setProgress(progress + 1);
            } else if (progress === 3) {
              handleFinish();
            }
          }}
          activeOpacity={0.88}
          className="w-full py-4 rounded-2xl shadow-sm items-center justify-center"
          style={{ backgroundColor: colors.brand }}
        >
          <Text className="text-base font-inter-bold text-white text-center">
            {progress === 3 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
        <PortalHost />
      </SafeAreaView>
    </OnboardingContext.Provider>
  );
}