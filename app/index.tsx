import { Text, View, Image } from "react-native";
import { Button as ButtonUI } from '@/components/ui/button';
import { Text as TextUI } from "@/components/ui/text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Settings } from "lucide-react-native";

export default function Index() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white px-4 pb-4 ">
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
      </View>

      <View className="flex-1 w-full flex items-center justify-center gap-12 ">
        <View className="h-[180px] w-[180px]">
          <Image 
            source={require("@/assets/images/hypergrid-logo.png")}
            className="w-full h-full"
            resizeMode="contain"
          />
        </View>
        <Text className="text-4xl font-chivo-bold text-black text-center">Log in to your account</Text>

        <ButtonUI 
          onPress={() => router.push("/(onboarding)")}
          variant='outline' 
          className="bg-custom-white h-fit flex-row items-center gap-3 px-6 py-3 border-custom-borderDisabled active:scale-95 active:bg-custom-disabled hover:bg-slate-100 transition-all duration-150"
        >
          <Image 
            source={require("@/assets/icons/google.png")}
            className="w-6 h-6"
            resizeMode="contain"
          />
          <TextUI className="text-lg font-quicksand text-black">Log in with google</TextUI>
        </ButtonUI>
      </View>

      <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-end px-4 py-4 z-10">
        <ButtonUI className="border-box bg-custom-primary h-fit w-fit p-2 rounded-full border-[6px] border-[#A1C3FB] active:scale-90 active:bg-blue-600 hover:scale-105 transition-all duration-150 shadow-lg">
          <Settings size={32} color="#F8FAFC" />
        </ButtonUI>
      </View>
    </SafeAreaView>
  );
}