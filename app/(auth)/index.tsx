import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  View,
} from "react-native";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { Touchable } from "@/components/ui/touchable";
import { useAuth } from "@/hooks/use-auth";
import {
  getApiBaseUrl,
  setRuntimeApiBaseUrl,
} from "@/services/api/config";
import { healthService } from "@/services/api/health.service";

/**
 * Auth / Login Screen (Terintegrasi Better-Auth & Server Settings).
 *
 * Referensi desain: Figma page "Final Page Mobile" → frame `Login` #114:1019.
 * Mendukung:
 *   - Auto-redirect jika sesi aktif
 *   - Masuk / Daftar Akun Petugas via Email & Password (Better-Auth)
 *   - Masuk cepat Google / Demo Petugas
 *   - Pengaturan Base URL Server & Health Check diagnostik (tombol Settings)
 */
export default function Index() {
  const router = useRouter();
  const {
    isOnboardingCompleted,
    signIn,
    signUp,
    signInWithGoogle,
    sessionExpiredNotice,
    clearSessionExpiredNotice,
  } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  // State Dialog Autentikasi
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("petugas@hypergrid.io");
  const [password, setPassword] = useState("passwordAman123");
  const [name, setName] = useState("Budi Santoso");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // State Dialog Konfigurasi Server
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getApiBaseUrl());
  const [healthStatus, setHealthStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [healthMsg, setHealthMsg] = useState("");

  // Session expired notice from middleware
  useEffect(() => {
    if (sessionExpiredNotice) {
      Alert.alert(
        "Session Expired",
        sessionExpiredNotice,
        [{ text: "Got it", onPress: () => clearSessionExpiredNotice() }]
      );
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
        // User baru register selalu diarahkan ke onboarding terlebih dahulu
        router.replace("/(onboarding)");
      } else {
        await signIn({ email: email.trim(), password });
        setAuthModalVisible(false);
        // User login biasa: jika belum pernah onboarding ke onboarding, jika sudah langsung ke tabs
        if (!isOnboardingCompleted) {
          router.replace("/(onboarding)");
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch (err: any) {
      Alert.alert("Sign In Failed", err.message || "Please check your server connection or credentials.");
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
    <SafeAreaView className="flex-1 bg-custom-white">
      <View className="flex-1 items-center justify-center gap-10 px-4">
        {/* Ilustrasi — Figma `hipergrid_final 1` #114:1023 (264×280) */}
        <Image
          contentFit="contain"
          source={require("@/assets/login/hipergrid-final.png")}
          style={{ height: 260, width: 245 }}
        />

        <View className="items-center gap-2">
          <Text className="text-center font-chivo-bold text-[32px] leading-[38px] text-[#0F172A]">
            Log in to your account
          </Text>
          <Text className="text-center font-quicksand text-sm text-slate-500">
            AI Road Damage Detection & Spatial Mapping Platform
          </Text>
        </View>

        {/* Session Expired Notice Banner */}
        {sessionExpiredNotice ? (
          <View className="w-full max-w-[320px] rounded-2xl border border-rose-200 bg-rose-50 p-3">
            <Text className="font-quicksand-bold text-xs text-rose-700">
              {sessionExpiredNotice}
            </Text>
          </View>
        ) : null}

        <View className="w-full max-w-[280px] gap-2.5">
          {/* Officer Sign In Button */}
          <Touchable
            accessibilityHint="Sign in with your email"
            accessibilityLabel="Sign In"
            accessibilityRole="button"
            onPress={() => {
              setIsRegisterMode(false);
              setAuthModalVisible(true);
            }}
          >
            <View className="flex-row items-center justify-center gap-2.5 rounded-[12px] bg-custom-primary px-4 py-3 shadow-sm">
              <Mail color="#FFFFFF" size={18} />
              <Text className="font-quicksand-semibold text-base text-white">
                Sign In
              </Text>
            </View>
          </Touchable>

          {/* Sign In with Google Button */}
          <Touchable
            accessibilityHint="Sign in with Google account"
            accessibilityLabel="Sign in with Google"
            accessibilityRole="button"
            onPress={handleGoogleSignIn}
          >
            <View className="flex-row items-center justify-center gap-3 rounded-[12px] border-[2px] border-[#E2E8F0] bg-white px-4 py-3">
              {googleLoading ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <>
                  <Image
                    contentFit="contain"
                    source={require("@/assets/icons/google.png")}
                    style={{ height: 18, width: 18 }}
                  />
                  <Text className="font-quicksand-semibold text-sm text-[#0F172A]">
                    Sign in with Google
                  </Text>
                </>
              )}
            </View>
          </Touchable>
        </View>
      </View>

      {/* Settings Button */}
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
          <View className="h-[48px] w-[48px] items-center justify-center rounded-full bg-[#3B82F6] shadow-md">
            <Settings color="#F8FAFC" size={24} />
          </View>
        </Touchable>
      </View>

      {/* EMAIL AUTHENTICATION MODAL (BETTER-AUTH) */}
      <Modal
        animationType="slide"
        transparent
        visible={authModalVisible}
        onRequestClose={() => setAuthModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-[32px] bg-white p-6 shadow-xl">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={22} color="#009EFF" />
                <Text className="font-chivo-bold text-xl text-[#0F172A]">
                  {isRegisterMode ? "User Registration" : "Sign In"}
                </Text>
              </View>
              <Touchable onPress={() => setAuthModalVisible(false)}>
                <View className="rounded-full bg-slate-100 p-1">
                  <X size={20} color="#64748B" />
                </View>
              </Touchable>
            </View>

            <View className="gap-4">
              {isRegisterMode ? (
                <View className="gap-1">
                  <Text className="font-quicksand-semibold text-xs text-slate-500">
                    Full Name
                  </Text>
                  <TextInput
                    autoCapitalize="words"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-quicksand text-sm text-[#0F172A]"
                    placeholder="Alex Johnson"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              ) : null}

              <View className="gap-1">
                <Text className="font-quicksand-semibold text-xs text-slate-500">
                  Email
                </Text>
                <TextInput
                  autoCapitalize="none"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-quicksand text-sm text-[#0F172A]"
                  keyboardType="email-address"
                  placeholder="user@hypergrid.io"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View className="gap-1">
                <Text className="font-quicksand-semibold text-xs text-slate-500">
                  Password
                </Text>
                <TextInput
                  autoCapitalize="none"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-quicksand text-sm text-[#0F172A]"
                  placeholder="••••••••"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <Touchable onPress={handleEmailAuth}>
                <View className="mt-2 items-center rounded-xl bg-custom-primary py-3.5">
                  {authSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text className="font-quicksand-bold text-base text-white">
                      {isRegisterMode ? "Register Now" : "Sign In"}
                    </Text>
                  )}
                </View>
              </Touchable>

              <View className="mt-2 flex-row items-center justify-center gap-1.5">
                <Text className="font-quicksand text-xs text-slate-500">
                  {isRegisterMode ? "Already have an account?" : "Don't have an account?"}
                </Text>
                <Touchable onPress={() => setIsRegisterMode((prev) => !prev)}>
                  <Text className="font-quicksand-bold text-xs text-custom-primary">
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
        <View className="flex-1 items-center justify-center bg-black/50 p-4">
          <View className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Server size={22} color="#3B82F6" />
                <Text className="font-chivo-bold text-lg text-[#0F172A]">
                  API Server Configuration
                </Text>
              </View>
              <Touchable onPress={() => setSettingsModalVisible(false)}>
                <View className="rounded-full bg-slate-100 p-1">
                  <X size={18} color="#64748B" />
                </View>
              </Touchable>
            </View>

            <View className="gap-3">
              <Text className="font-quicksand text-xs text-slate-500">
                Set HyperGrid NestJS backend Base URL for your dev environment (Emulator: 10.0.2.2, iOS: localhost, Physical Device: LAN IP).
              </Text>

              <TextInput
                autoCapitalize="none"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-xs text-[#0F172A]"
                placeholder={process.env.EXPO_PUBLIC_API_URL || "https://hg-server.onrender.com"}
                value={serverUrlInput}
                onChangeText={setServerUrlInput}
              />

              {/* Status Health */}
              {healthStatus !== "idle" ? (
                <View className="flex-row items-center gap-2 rounded-xl bg-slate-50 p-2.5">
                  {healthStatus === "checking" ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : healthStatus === "ok" ? (
                    <CheckCircle2 size={16} color="#10B981" />
                  ) : (
                    <XCircle size={16} color="#EF4444" />
                  )}
                  <Text
                    className={`font-mono text-[11px] ${
                      healthStatus === "ok"
                        ? "text-emerald-700"
                        : healthStatus === "error"
                        ? "text-rose-600"
                        : "text-slate-600"
                    }`}
                  >
                    {healthMsg}
                  </Text>
                </View>
              ) : null}

              {/* Test Connection & Save Buttons */}
              <View className="mt-2 flex-row gap-2">
                <Touchable className="flex-1" onPress={handleTestServer}>
                  <View className="items-center rounded-xl border border-slate-300 bg-slate-100 py-2.5">
                    <Text className="font-quicksand-semibold text-xs text-slate-700">
                      Test Connection
                    </Text>
                  </View>
                </Touchable>

                <Touchable className="flex-1" onPress={handleSaveServerConfig}>
                  <View className="items-center rounded-xl bg-[#3B82F6] py-2.5">
                    <Text className="font-quicksand-semibold text-xs text-white">
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
