import { useContext } from "react";
import { View, Text, Image } from "react-native";
import { OnboardingContext } from "./_layout";

export default function Index() {
  const { progress } = useContext(OnboardingContext)!;

  let imageSource;

  switch (progress) {
    case 1:
      imageSource = require("@/assets/images/onboard/onboard-1.png");
      break;
    case 2:
      imageSource = require("@/assets/images/onboard/onboard-2.png");
      break;
    case 3:
      imageSource = require("@/assets/images/onboard/onboard-3.png");
      break;
    default:
      imageSource = require("@/assets/images/onboard/onboard-1.png");
  }
  
  return (
    <>
        <View className="h-[200px] w-[200px]">
          <Image 
            source={imageSource}
            className="w-full h-full"
            resizeMode="contain"
          />
        </View>
        <Text className="text-3xl font-chivo-bold text-center text-black px-4">
            Smarter Roads, Together
        </Text>
        <Text className="text-lg font-quicksand text-center text-black px-4">
            View hazard points along your route.
        </Text>
    </>
  );
}