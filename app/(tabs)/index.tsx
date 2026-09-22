import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function StartScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center p-4">
      <Text className="text-3xl font-chivo-bold text-black mb-2">
        Start Screen
      </Text>
      <Text className="text-base font-quicksand text-slate-500 text-center">
        This is the first start screen.
      </Text>
    </SafeAreaView>
  );
}