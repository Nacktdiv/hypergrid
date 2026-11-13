import { Tabs } from "expo-router";
import { CarFront, RotateCcwClock, Settings, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/contexts/theme-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: false,
        animation: "none",
        sceneStyle: { backgroundColor: colors.canvas },
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBorder,
          borderTopWidth: 1,
          height: 58 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Start",
          tabBarAccessibilityLabel: "Start Tab",
          tabBarIcon: ({ color, focused }) => (
            <CarFront size={22} color={color} strokeWidth={focused ? 2.4 : 1.9} />
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
              strokeWidth={focused ? 2.4 : 1.9}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          lazy: false,
          tabBarAccessibilityLabel: "Profile Tab",
          tabBarIcon: ({ color, focused }) => (
            <User size={22} color={color} strokeWidth={focused ? 2.4 : 1.9} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          lazy: false,
          tabBarAccessibilityLabel: "Settings Tab",
          tabBarIcon: ({ color, focused }) => (
            <Settings
              size={22}
              color={color}
              strokeWidth={focused ? 2.4 : 1.9}
            />
          ),
        }}
      />
    </Tabs>
  );
}
