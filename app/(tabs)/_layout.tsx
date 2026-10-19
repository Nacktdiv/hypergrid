import { View, Text } from "react-native";
import { usePathname } from "expo-router";
import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";
import { CarFront, RotateCcwClock, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function FilledTabList({ children, style, ...props }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      className="w-full bg-white border-t border-slate-200/80 shadow-xs"
      style={[
        style,
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        },
      ]}
    >
      {children}
    </View>
  );
}

export default function RootLayout() {
  const pathname = usePathname();

  const isStartFocused =
    pathname === "/" ||
    pathname === "/(tabs)" ||
    pathname === "/(tabs)/" ||
    pathname === "/(tabs)/index";
  const isHistoryFocused = pathname.includes("history");
  const isProfileFocused = pathname.includes("profile");

  return (
    <Tabs className="flex-1 bg-surface-canvas">
      <TabSlot />
      <TabList asChild>
        <FilledTabList>
          <TabTrigger
            name="index"
            href="/(tabs)"
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 4,
            }}
            accessibilityRole="tab"
            accessibilityLabel="Start Tab"
          >
            <View
              style={{ alignItems: "center", justifyContent: "center" }}
              className="gap-0.5"
            >
              <CarFront
                size={22}
                color={isStartFocused ? "#009EFF" : "#64748B"}
              />
              <Text
                className={`text-xs ${
                  isStartFocused
                    ? "font-quicksand-bold text-brand"
                    : "font-quicksand-medium text-slate-600"
                }`}
              >
                Start
              </Text>
            </View>
          </TabTrigger>

          <TabTrigger
            name="history"
            href="/(tabs)/history"
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 4,
            }}
            accessibilityRole="tab"
            accessibilityLabel="History Tab"
          >
            <View
              style={{ alignItems: "center", justifyContent: "center" }}
              className="gap-0.5"
            >
              <RotateCcwClock
                size={22}
                color={isHistoryFocused ? "#009EFF" : "#64748B"}
              />
              <Text
                className={`text-xs ${
                  isHistoryFocused
                    ? "font-quicksand-bold text-brand"
                    : "font-quicksand-medium text-slate-600"
                }`}
              >
                History
              </Text>
            </View>
          </TabTrigger>

          <TabTrigger
            name="profile"
            href="/(tabs)/profile"
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 4,
            }}
            accessibilityRole="tab"
            accessibilityLabel="Profile Tab"
          >
            <View
              style={{ alignItems: "center", justifyContent: "center" }}
              className="gap-0.5"
            >
              <User
                size={22}
                color={isProfileFocused ? "#009EFF" : "#64748B"}
              />
              <Text
                className={`text-xs ${
                  isProfileFocused
                    ? "font-quicksand-bold text-brand"
                    : "font-quicksand-medium text-slate-600"
                }`}
              >
                Profile
              </Text>
            </View>
          </TabTrigger>
        </FilledTabList>
      </TabList>
    </Tabs>
  );
}
