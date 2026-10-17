import { View, Text } from "react-native";
import { usePathname } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { CarFront, RotateCcwClock, User } from "lucide-react-native";

function CustomTabList({ children, ...props }: any) {
    return (
        <View className="w-full h-fit py-4 bg-custom-white">
            <View className="self-center">
                <View {...props} className="flex-row items-center justify-between bg-custom-black rounded-full px-8 py-2 gap-6">
                    {children}
                </View>
            </View>
        </View>
    );
}

export default function RootLayout() {
    const pathname = usePathname();

    const isStartFocused = pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/" || pathname === "/(tabs)/index";
    const isHistoryFocused = pathname.includes("history");
    const isProfileFocused = pathname.includes("profile");

    return (
        <Tabs className="flex-1 bg-custom-white">
            <TabSlot />
            <TabList asChild >
                <CustomTabList>
                    <TabTrigger name="index" href="/(tabs)" className="w-fit" accessibilityRole="tab" accessibilityLabel="Start Tab">
                        <View className="flex-col items-center justify-center gap-1 py-2">
                            <CarFront size={20} color={isStartFocused ? "#F8FAFC" : "#94A3B8"} />
                            <Text className={`text-sm font-quicksand ${isStartFocused ? "text-white" : "text-slate-400"}`}>Start</Text>
                        </View>
                    </TabTrigger>

                    <TabTrigger name="history" href="/(tabs)/history" className="w-fit" accessibilityRole="tab" accessibilityLabel="History Tab">
                        <View className="flex-col items-center justify-center gap-1 py-2">
                            <RotateCcwClock size={20} color={isHistoryFocused ? "#F8FAFC" : "#94A3B8"} />
                            <Text className={`text-sm font-quicksand ${isHistoryFocused ? "text-white" : "text-slate-400"}`}>History</Text>
                        </View>
                    </TabTrigger>

                    <TabTrigger name="profile" href="/(tabs)/profile" className="w-fit" accessibilityRole="tab" accessibilityLabel="Profile Tab">
                        <View className="flex-col items-center justify-center gap-1 py-2">
                            <User size={20} color={isProfileFocused ? "#F8FAFC" : "#94A3B8"} />
                            <Text className={`text-sm font-quicksand ${isProfileFocused ? "text-white" : "text-slate-400"}`}>Profile</Text>
                        </View>
                    </TabTrigger>
                </CustomTabList>
            </TabList>
        </Tabs>
    );
}
