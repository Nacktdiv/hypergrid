import { useState, useEffect, createContext } from "react";
import { View, Text, Image } from "react-native";
import { Button as ButtonUI } from '@/components/ui/button';
import { Text as TextUI } from "@/components/ui/text";
import { Progress as ProgressUI } from '@/components/ui/progress';
import { SafeAreaView } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";
import { Slot, useRouter } from "expo-router";

import { useAuth } from "@/hooks/use-auth";

export type OnboardingContextType = {
    progress: number;
    setProgress: React.Dispatch<React.SetStateAction<number>>;
};

export const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export default function RootLayout() {
    const router = useRouter();
    const { completeOnboarding } = useAuth();

    const [percentage, setPercentage] = useState<number>(0);
    const [progress, setProgress] = useState<number>(1);

    useEffect(() => {
        const constant = 100 / 3
        const timer = setTimeout(() => setPercentage(constant * progress), 250);
        return () => clearTimeout(timer);
    }, [progress]);

    const handleFinish = async () => {
        await completeOnboarding();
        router.replace("/(tabs)");
    };

    return (
        <OnboardingContext.Provider value={{ progress, setProgress }}>
            <SafeAreaView className="relative flex-1 items-center justify-center bg-white px-4 pb-8">
                <View className="w-full h-20 flex-row items-center justify-between py-4 z-10">
                    <View className="flex h-full flex-row items-center gap-2">
                        <View className="h-full aspect-square">
                            <Image 
                                source={require("@/assets/images/iconH.png")}
                                className="w-full h-full"
                                resizeMode="contain"
                            />
                        </View>
                        <Text className="text-xl font-chivo-bold text-black">HYPERGRID</Text>
                    </View>
                    
                    <ButtonUI 
                        onPress={handleFinish}
                        className="bg-transparent h-fit px-3 py-1.5 rounded-lg active:bg-slate-100 active:scale-95 hover:bg-slate-50 transition-all duration-150">
                        <TextUI className="text-lg font-quicksand-bold text-black active:opacity-70">Skip</TextUI>
                    </ButtonUI>
                </View>

                <ProgressUI value={percentage} className="w-full h-2 bg-slate-100 rounded-full overflow-hidden" indicatorClassName="bg-custom-primary transition-all duration-300 ease-out" />
                
                <View className="flex-1 w-full items-center justify-center gap-6">
                    <Slot />
                </View>

                <ButtonUI 
                    onPress={() => {
                        if (progress < 3) {
                            setProgress(progress + 1);
                        } else if (progress === 3) {
                            handleFinish();
                        }
                    }}
                    className="bg-custom-primary w-full h-fit py-2 rounded-xl shadow-md active:scale-[0.98] active:opacity-90 hover:opacity-95 hover:shadow-lg transition-all duration-150">
                    <TextUI className="text-lg font-quicksand-bold text-white text-center">Next</TextUI>
                </ButtonUI>
                <PortalHost />
            </SafeAreaView>
        </OnboardingContext.Provider>
    )
}