import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Step = "phone" | "code";
type Mode = "signin" | "signup";

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();

  const [step, setStep] = useState<Step>("phone");
  const [mode, setMode] = useState<Mode>("signin");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode() {
    if (!signInLoaded || !signUpLoaded) return;
    setError(null);
    setLoading(true);
    try {
      const digits = phoneNumber.replace(/\D/g, "");
      const formatted = `+1${digits.startsWith("1") ? digits.slice(1) : digits}`;
      console.log("Attempting with:", formatted);
      try {
        await signIn.create({ strategy: "phone_code", identifier: formatted });
        setMode("signin");
        setStep("code");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (signInErr: any) {
        await signUp.create({ phoneNumber: formatted });
        await signUp.preparePhoneNumberVerification();
        setMode("signup");
        setStep("code");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? "Could not send code.";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!signInLoaded || !signUpLoaded) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        let result = await signUp.attemptPhoneNumberVerification({ code });
        console.log("signUp verify result status:", result.status);
        console.log("SignUp result:", JSON.stringify(result));
        if (result.status === "missing_requirements") {
          result = await signUp.update({});
        }
        if (result.status === "complete") {
          await setActiveSignUp({ session: result.createdSessionId });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace("/(tabs)" as Href);
        } else {
          setError("Status: " + result.status);
        }
      } else {
        const result = await signIn.attemptFirstFactor({ strategy: "phone_code", code });
        console.log("signIn verify result status:", result.status);
        console.log("SignIn result:", JSON.stringify(result));
        if (result.status === "complete") {
          await setActiveSignIn({ session: result.createdSessionId });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace("/(tabs)" as Href);
        } else {
          setError("Status: " + result.status);
        }
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? "Invalid code.";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  function handleChangeNumber() {
    setCode("");
    setError(null);
    setMode("signin");
    setStep("phone");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.inner,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={{ width: 80, height: 80, borderRadius: 18, marginBottom: 8 }}
            contentFit="cover"
          />
          <Text style={[styles.title, { color: colors.foreground }]}>LifeLens</Text>
        </View>

        {step === "phone" ? (
          <>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Track your progress, one photo at a time.
            </Text>

            <TextInput
              testID="signin-phone"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              keyboardType="phone-pad"
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={colors.mutedForeground}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              autoFocus
            />

            {error && (
              <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
            )}

            <Pressable
              testID="signin-send-code"
              onPress={handleSendCode}
              disabled={!phoneNumber.trim() || loading}
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor: phoneNumber.trim() ? colors.primary : colors.muted,
                  opacity: !phoneNumber.trim() || loading ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  { color: phoneNumber.trim() ? "#000" : colors.mutedForeground },
                ]}
              >
                {loading ? "Sending…" : "Send Code"}
              </Text>
            </Pressable>

            {phoneNumber.trim() ? (
              <Pressable onPress={() => setPhoneNumber("")} style={styles.changeNumber}>
                <Text style={[styles.changeNumberText, { color: colors.mutedForeground }]}>
                  Try again
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Enter the 6-digit code sent to {phoneNumber}
            </Text>

            <TextInput
              testID="signin-code"
              style={[
                styles.input,
                styles.codeInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              keyboardType="number-pad"
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              value={code}
              onChangeText={setCode}
              maxLength={6}
              autoFocus
            />

            {error && (
              <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
            )}

            <Pressable
              testID="signin-verify"
              onPress={handleVerify}
              disabled={code.length < 6 || loading}
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor: code.length === 6 ? colors.primary : colors.muted,
                  opacity: code.length < 6 || loading ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  { color: code.length === 6 ? "#000" : colors.mutedForeground },
                ]}
              >
                {loading ? "Verifying…" : "Verify"}
              </Text>
            </Pressable>

            <Pressable onPress={handleChangeNumber} style={styles.changeNumber}>
              <Text style={[styles.changeNumberText, { color: colors.mutedForeground }]}>
                Try again
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    gap: 14,
  },
  title: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: "Inter_400Regular",
  },
  codeInput: {
    letterSpacing: 8,
    textAlign: "center",
  },
  error: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  changeNumber: {
    alignItems: "center",
    paddingVertical: 8,
  },
  changeNumberText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
  logoContainer: {
    alignItems: "center",
  },
});
