import { Ionicons } from "@expo/vector-icons";
import { useAuth, useSignUp } from "@clerk/expo";
import * as Haptics from "expo-haptics";
import { Link, router, type Href } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const needsVerification =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  async function handleSubmit() {
    setSubmitError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      setSubmitError(error.message ?? "Could not create account.");
      return;
    }
    await signUp.verifications.sendEmailCode();
  }

  async function handleVerify() {
    setSubmitError(null);
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: () => {
          router.replace("/" as Href);
        },
      });
    } else {
      setSubmitError("Could not verify code. Try requesting a new one.");
    }
  }

  if (isSignedIn) return null;

  const submitting = fetchStatus === "fetching";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          { paddingTop: topPadding + 8, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.closeBtn}>
          <Ionicons name="chevron-down" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {needsVerification ? "Verify email" : "Create account"}
        </Text>
        <View style={styles.closeBtn} />
      </View>

      {needsVerification ? (
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Verification code
          </Text>
          <TextInput
            testID="signup-code"
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
            keyboardType="numeric"
            placeholder="6-digit code"
            placeholderTextColor={colors.mutedForeground}
            value={code}
            onChangeText={setCode}
          />
          {errors.fields.code && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {errors.fields.code.message}
            </Text>
          )}
          {submitError && (
            <Text style={[styles.error, { color: colors.destructive, marginTop: 8 }]}>
              {submitError}
            </Text>
          )}
          <Pressable
            testID="signup-verify"
            onPress={handleVerify}
            disabled={!code || submitting}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: colors.primary,
                opacity: !code || submitting ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>Verify</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => signUp.verifications.sendEmailCode()}
            style={{ alignSelf: "center", marginTop: 14 }}
          >
            <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>
              Send a new code
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Email address
          </Text>
          <TextInput
            testID="signup-email"
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={emailAddress}
            onChangeText={setEmailAddress}
          />
          {errors.fields.emailAddress && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {errors.fields.emailAddress.message}
            </Text>
          )}

          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 14 }]}>
            Password
          </Text>
          <TextInput
            testID="signup-password"
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 8 characters"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
          />
          {errors.fields.password && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {errors.fields.password.message}
            </Text>
          )}

          {submitError && (
            <Text style={[styles.error, { color: colors.destructive, marginTop: 8 }]}>
              {submitError}
            </Text>
          )}

          <Pressable
            testID="signup-submit"
            onPress={handleSubmit}
            disabled={!emailAddress || !password || submitting}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: colors.primary,
                opacity: !emailAddress || !password || submitting ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>Create account</Text>
            )}
          </Pressable>

          <View style={styles.linkRow}>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
              Already have an account?{" "}
            </Text>
            <Link href={"/sign-in" as Href} replace>
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                Sign in
              </Text>
            </Link>
          </View>

          <View nativeID="clerk-captcha" />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  form: { padding: 20, gap: 4 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  error: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6 },
  submitBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#000" },
  linkRow: { marginTop: 18, flexDirection: "row", justifyContent: "center" },
});
