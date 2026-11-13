import { useContext } from "react";
import { View, Text, Image } from "react-native";

import { useAppTheme } from "@/contexts/theme-context";
import { OnboardingContext } from "./_layout";

export default function Index() {
  const { progress } = useContext(OnboardingContext)!;
  const { colors } = useAppTheme();

  let imageSource;
  let title = "Smarter Roads, Together";
  let description =
    "Real-time road hazard detection and spatial infrastructure mapping.";

  switch (progress) {
    case 1:
      imageSource = require("@/assets/images/onboard/onboard-1.png");
      title = "Smarter Roads, Together";
      description =
        "Real-time road hazard detection and spatial infrastructure mapping.";
      break;
    case 2:
      imageSource = require("@/assets/images/onboard/onboard-2.png");
      title = "Edge AI On-Device Detection";
      description =
        "Automated shock analysis and pothole identification powered by device sensors.";
      break;
    case 3:
      imageSource = require("@/assets/images/onboard/onboard-3.png");
      title = "Driver Early Warning";
      description =
        "Proactive proximity alerts for road anomalies along your driving route.";
      break;
    default:
      imageSource = require("@/assets/images/onboard/onboard-1.png");
  }

  return (
    <>
      <View className="h-[220px] w-[220px]">
        <Image
          source={imageSource}
          className="w-full h-full"
          resizeMode="contain"
        />
      </View>
      <Text
        className="text-2xl font-inter-extrabold text-center px-4 tracking-tight"
        style={{ color: colors.text }}
      >
        {title}
      </Text>
      <Text
        className="text-base font-inter text-center px-6 leading-6"
        style={{ color: colors.textMuted }}
      >
        {description}
      </Text>
    </>
  );
}