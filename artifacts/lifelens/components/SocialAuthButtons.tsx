import { Ionicons } from "@expo/vector-icons";
import { useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { router, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

type Strategy = "oauth_google" | "oauth_apple";

export function SocialAuthButtons({ mode }: { mode: "sign-in" | "sign-up" }) {
  const colors = useColors();
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState<Strategy | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePress = useCallback(
    async (strategy: Strategy) => {
      if (busy) return;
      setError(null);
      setBusy(strategy);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
          redirectUrl: AuthSession.makeRedirectUri({ scheme: "lifelens" }),
        });
        if (createdSessionId && setActive) {
          await setActive({
            session: createdSessionId,
            navigate: () => {
              router.replace("/" as Href);
            },
          });
        } else {
          setError("Sign-in did not complete. Try again.");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not sign in.";
        if (!/cancel/i.test(message)) {
          setError(message);
        }
      } finally {
        setBusy(null);
      }
    },
    [busy, startSSOFlow],
  );

  const verb = mode === "sign-up" ? "Sign up" : "Continue";

  return (
    <View style={styles.container}>
      <Pressable
        testID={`${mode}-google`}
        onPress={() => handlePress("oauth_google")}
        disabled={busy !== null}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: busy && busy !== "oauth_google" ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {busy === "oauth_google" ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color={colors.foreground} />
            <Text style={[styles.buttonText, { color: colors.foreground }]}>
              {verb} with Google
            </Text>
          </>
        )}
      </Pressable>

      {Platform.OS === "ios" && (
        <Pressable
          testID={`${mode}-apple`}
          onPress={() => handlePress("oauth_apple")}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.foreground,
              borderColor: colors.foreground,
              opacity: busy && busy !== "oauth_apple" ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {busy === "oauth_apple" ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <>
              <Ionicons
                name="logo-apple"
                size={18}
                color={colors.background}
              />
              <Text style={[styles.buttonText, { color: colors.background }]}>
                {verb} with Apple
              </Text>
            </>
          )}
        </Pressable>
      )}

      {error && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      )}

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
          or
        </Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, marginBottom: 18 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 13,
  },
  buttonText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  error: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
