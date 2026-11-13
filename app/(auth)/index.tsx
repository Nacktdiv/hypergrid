import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  CheckCircle2,
  Mail,
  Server,
  Settings,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Touchable } from "@/components/ui/touchable";
import { useAppTheme } from "@/contexts/theme-context";
import { useAuth } from "@/hooks/use-auth";
import { getApiBaseUrl, setRuntimeApiBaseUrl } from "@/services/api/config";
import { healthService } from "@/services/api/health.service";

export default function Index() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const {
    isOnboardingCompleted,
    signIn,
    signUp,
    signInWithGoogle,
    sessionExpiredNotice,
    clearSessionExpiredNotice,
  } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("petugas@hypergrid.io");
  const [password, setPassword] = useState("passwordAman123");
  const [name, setName] = useState("Budi Santoso");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getApiBaseUrl());
  const [healthStatus, setHealthStatus] = useState<
    "idle" | "checking" | "ok" | "error"
  >("idle");
  const [healthMsg, setHealthMsg] = useState("");

  useEffect(() => {
    if (sessionExpiredNotice) {
      Alert.alert("Session Expired", sessionExpiredNotice, [
        { text: "Got it", onPress: () => clearSessionExpiredNotice() },
      ]);
    }
  }, [sessionExpiredNotice, clearSessionExpiredNotice]);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Attention", "Email and password are required.");
      return;
    }

    setAuthSubmitting(true);
    try {
      if (isRegisterMode) {
        if (!name.trim()) {
          Alert.alert("Attention", "Full name is required for registration.");
          setAuthSubmitting(false);
          return;
        }
        await signUp({ email: email.trim(), password, name: name.trim() });
        setAuthModalVisible(false);
        router.replace("/(onboarding)");
      } else {
        await signIn({ email: email.trim(), password });
        setAuthModalVisible(false);
        if (!isOnboardingCompleted) {
          router.replace("/(onboarding)");
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch (err: any) {
      Alert.alert(
        "Sign In Failed",
        err.message || "Please check your server connection or credentials."
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const res = await signInWithGoogle();
      if (res?.user) {
        if (!isOnboardingCompleted) {
          router.replace("/(onboarding)");
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch (err: any) {
      Alert.alert(
        "Google Sign-In",
        err.message || "Failed to sign in with Google OAuth."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleTestServer = async () => {
    setHealthStatus("checking");
    setHealthMsg("Connecting to server...");
    try {
      setRuntimeApiBaseUrl(serverUrlInput.trim());
      const res = await healthService.checkHealth();
      setHealthStatus("ok");
      setHealthMsg(`Connected: ${res.service} (${res.status})`);
    } catch (err: any) {
      setHealthStatus("error");
      setHealthMsg(`Connection Failed: ${err.message || "Network Error"}`);
    }
  };

  const handleSaveServerConfig = () => {
    setRuntimeApiBaseUrl(serverUrlInput.trim());
    setSettingsModalVisible(false);
    Alert.alert("Saved", `Base URL updated to: ${serverUrlInput.trim()}`);
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.canvas }}
    >
      <View className="flex-1 items-center justify-center gap-8 px-5">
        <Image
          contentFit="contain"
          source={require("@/assets/login/hipergrid-final.png")}
          style={{ height: 245, width: 235 }}
        />

        <View className="items-center gap-2">
          <Text
            className="text-center font-inter-extrabold text-[30px] leading-[36px] tracking-tight"
            style={{ color: colors.text }}
          >
            Log in to your account
          </Text>
          <Text
            className="text-center font-inter text-sm px-4"
            style={{ color: colors.textMuted }}
          >
            AI Road Damage Detection & Spatial Mapping Platform
          </Text>
        </View>

        {sessionExpiredNotice ? (
          <View
            className="w-full max-w-[320px] rounded-2xl border p-3"
            style={{
              backgroundColor: colors.dangerSoft,
              borderColor: isDark ? "rgba(239,68,68,0.35)" : "#FECDD3",
            }}
          >
            <Text
              className="font-inter-bold text-xs"
              style={{ color: colors.dangerText }}
            >
              {sessionExpiredNotice}
            </Text>
          </View>
        ) : null}

        <View className="w-full max-w-[290px] gap-3">
          <Touchable
            accessibilityHint="Sign in with your email"
            accessibilityLabel="Sign In"
            accessibilityRole="button"
            onPress={() => {
              setIsRegisterMode(false);
              setAuthModalVisible(true);
            }}
          >
            <View
              className="flex-row items-center justify-center gap-2.5 rounded-2xl px-4 py-3.5 shadow-sm"
              style={{ backgroundColor: colors.brand }}
            >
              <Mail color="#FFFFFF" size={18} />
              <Text className="font-inter-bold text-base text-white">
                Sign In
              </Text>
            </View>
          </Touchable>

          <Touchable
            accessibilityHint="Sign in with Google account"
            accessibilityLabel="Sign in with Google"
            accessibilityRole="button"
            onPress={handleGoogleSignIn}
          >
            <View
              className="flex-row items-center justify-center gap-3 rounded-2xl border px-4 py-3.5"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.borderStrong,
              }}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <>
                  <Image
                    contentFit="contain"
                    source={require("@/assets/icons/google.png")}
                    style={{ height: 18, width: 18 }}
                  />
                  <Text
                    className="font-inter-bold text-sm"
                    style={{ color: colors.text }}
                  >
                    Sign in with Google
                  </Text>
                </>
              )}
            </View>
          </Touchable>
        </View>
      </View>

      {/* Server Settings FAB */}
      <View className="absolute bottom-6 right-6">
        <Touchable
          accessibilityLabel="Open server settings"
          accessibilityRole="button"
          onPress={() => {
            setServerUrlInput(getApiBaseUrl());
            setHealthStatus("idle");
            setHealthMsg("");
            setSettingsModalVisible(true);
          }}
        >
          <View
            className="h-12 w-12 items-center justify-center rounded-full shadow-md"
            style={{ backgroundColor: colors.brand }}
          >
            <Settings color="#FFFFFF" size={22} />
          </View>
        </Touchable>
      </View>

      {/* EMAIL AUTHENTICATION MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={authModalVisible}
        onRequestClose={() => setAuthModalVisible(false)}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.overlay }}
        >
          <View
            className="rounded-t-[32px] p-6 border-t shadow-xl"
            style={{
              backgroundColor: colors.sheet,
              borderTopColor: colors.border,
            }}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={22} color={colors.brand} />
                <Text
                  className="font-inter-extrabold text-xl"
                  style={{ color: colors.text }}
                >
                  {isRegisterMode ? "User Registration" : "Sign In"}
                </Text>
              </View>
              <Touchable onPress={() => setAuthModalVisible(false)}>
                <View
                  className="rounded-full p-2"
                  style={{ backgroundColor: colors.subtle }}
                >
                  <X size={18} color={colors.textMuted} />
                </View>
              </Touchable>
            </View>

            <View className="gap-4">
              {isRegisterMode ? (
                <View className="gap-1.5">
                  <Text
                    className="font-inter-semibold text-xs"
                    style={{ color: colors.textMuted }}
                  >
                    Full Name
                  </Text>
                  <TextInput
                    autoCapitalize="words"
                    className="rounded-xl border px-4 py-3 font-inter text-sm"
                    style={{
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                    placeholder="Alex Johnson"
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              ) : null}

              <View className="gap-1.5">
                <Text
                  className="font-inter-semibold text-xs"
                  style={{ color: colors.textMuted }}
                >
                  Email
                </Text>
                <TextInput
                  autoCapitalize="none"
                  className="rounded-xl border px-4 py-3 font-inter text-sm"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  keyboardType="email-address"
                  placeholder="user@hypergrid.io"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View className="gap-1.5">
                <Text
                  className="font-inter-semibold text-xs"
                  style={{ color: colors.textMuted }}
                >
                  Password
                </Text>
                <TextInput
                  autoCapitalize="none"
                  className="rounded-xl border px-4 py-3 font-inter text-sm"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <Touchable onPress={handleEmailAuth}>
                <View
                  className="mt-2 items-center rounded-2xl py-3.5"
                  style={{ backgroundColor: colors.brand }}
                >
                  {authSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text className="font-inter-bold text-base text-white">
                      {isRegisterMode ? "Register Now" : "Sign In"}
                    </Text>
                  )}
                </View>
              </Touchable>

              <View className="mt-1 flex-row items-center justify-center gap-1.5">
                <Text
                  className="font-inter text-xs"
                  style={{ color: colors.textMuted }}
                >
                  {isRegisterMode
                    ? "Already have an account?"
                    : "Don't have an account?"}
                </Text>
                <Touchable onPress={() => setIsRegisterMode((prev) => !prev)}>
                  <Text
                    className="font-inter-bold text-xs"
                    style={{ color: colors.brand }}
                  >
                    {isRegisterMode ? "Sign in here" : "Register here"}
                  </Text>
                </Touchable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* SERVER CONFIGURATION & HEALTH CHECK MODAL */}
      <Modal
        animationType="fade"
        transparent
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View
          className="flex-1 items-center justify-center p-4"
          style={{ backgroundColor: colors.overlay }}
        >
          <View
            className="w-full max-w-sm rounded-3xl p-6 border shadow-2xl"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Server size={20} color={colors.brand} />
                <Text
                  className="font-inter-extrabold text-lg"
                  style={{ color: colors.text }}
                >
                  API Server Configuration
                </Text>
              </View>
              <Touchable onPress={() => setSettingsModalVisible(false)}>
                <View
                  className="rounded-full p-1.5"
                  style={{ backgroundColor: colors.subtle }}
                >
                  <X size={16} color={colors.textMuted} />
                </View>
              </Touchable>
            </View>

            <View className="gap-3">
              <Text
                className="font-inter text-xs leading-5"
                style={{ color: colors.textMuted }}
              >
                Set HyperGrid NestJS backend Base URL for your dev environment
                (Emulator: 10.0.2.2, iOS: localhost, Physical Device: LAN IP).
              </Text>

              <TextInput
                autoCapitalize="none"
                className="rounded-xl border px-3 py-2.5 font-mono text-xs"
                style={{
                  backgroundColor: colors.cardMuted,
                  borderColor: colors.border,
                  color: colors.text,
                }}
                placeholder={
                  process.env.EXPO_PUBLIC_API_URL ||
                  "https://hg-server.onrender.com"
                }
                placeholderTextColor={colors.textMuted}
                value={serverUrlInput}
                onChangeText={setServerUrlInput}
              />

              {healthStatus !== "idle" ? (
                <View
                  className="flex-row items-center gap-2 rounded-xl border p-2.5"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  }}
                >
                  {healthStatus === "checking" ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : healthStatus === "ok" ? (
                    <CheckCircle2 size={16} color={colors.success} />
                  ) : (
                    <XCircle size={16} color={colors.danger} />
                  )}
                  <Text
                    className="font-mono text-[11px] flex-1"
                    style={{
                      color:
                        healthStatus === "ok"
                          ? colors.successText
                          : healthStatus === "error"
                            ? colors.dangerText
                            : colors.textSecondary,
                    }}
                  >
                    {healthMsg}
                  </Text>
                </View>
              ) : null}

              <View className="mt-2 flex-row gap-2.5">
                <Touchable className="flex-1" onPress={handleTestServer}>
                  <View
                    className="items-center rounded-xl border py-3"
                    style={{
                      backgroundColor: colors.subtle,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      className="font-inter-semibold text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      Test Connection
                    </Text>
                  </View>
                </Touchable>

                <Touchable className="flex-1" onPress={handleSaveServerConfig}>
                  <View
                    className="items-center rounded-xl py-3"
                    style={{ backgroundColor: colors.brand }}
                  >
                    <Text className="font-inter-bold text-xs text-white">
                      Save
                    </Text>
                  </View>
                </Touchable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
