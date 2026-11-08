import { Tabs } from "expo-router";
import { CarFront, RotateCcwClock, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#FFF",
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 10),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#0040FF",
        tabBarInactiveTintColor: "#64748B",
        tabBarLabelStyle: {
          // fontFamily: "Inter_700Bold",
          fontSize: 9,
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Start",
          tabBarAccessibilityLabel: "Start Tab",
          tabBarIcon: ({ color, focused }) => (
            <CarFront size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarAccessibilityLabel: "History Tab",
          tabBarIcon: ({ color, focused }) => (
            <RotateCcwClock
              size={22}
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarAccessibilityLabel: "Profile Tab",
          tabBarIcon: ({ color, focused }) => (
            <User size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
    </Tabs>
  );
}
