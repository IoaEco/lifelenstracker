import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "expo-image";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const { scheme, setMode } = useTheme();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPadding + 8, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          testID="account-close"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.closeBtn}
        >
          <Ionicons name="chevron-down" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Account
        </Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={[styles.appearanceRow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, margin: 20, marginBottom: 0 }]}>
        <Ionicons
          name={scheme === "dark" ? "moon-outline" : "sunny-outline"}
          size={20}
          color={colors.foreground}
        />
        <Text style={[styles.appearanceLabel, { color: colors.foreground }]}>
          Appearance
        </Text>
        <Switch
          value={scheme === "dark"}
          onValueChange={(isDark) => {
            Haptics.selectionAsync();
            void setMode(isDark ? "dark" : "light");
          }}
          trackColor={{ false: "#767577", true: colors.primary }}
          thumbColor="#ffffff"
          ios_backgroundColor="#767577"
        />
      </View>

      <View style={styles.content}>
        {!isSignedIn && !user ? (
          <>
            <View style={[styles.heroIcon, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="person-outline" size={44} color={colors.primary} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Sign in to LifeLens
            </Text>
            <Pressable
              testID="account-signin"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/sign-in" as Href);
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.primaryBtnText}>Sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={[styles.heroIcon, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="person" size={44} color={colors.primary} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Signed in
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={{ width: 28, height: 28, borderRadius: 6 }}
                contentFit="cover"
              />
              <Text style={[styles.appName, { color: colors.mutedForeground }]}>LifeLens</Text>
            </View>
            <Text style={[styles.version, { color: colors.mutedForeground }]}>
              Version 1.0.0
            </Text>

            <Pressable
              testID="account-signout"
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                await signOut();
                router.replace("/sign-in" as Href);
              }}
              style={({ pressed }) => [
                styles.signoutBtn,
                { backgroundColor: colors.destructive, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.signoutText}>Sign out</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
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
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  appName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  version: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 16,
  },
  primaryBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
  },
  signoutBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  signoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  appearanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appearanceLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
