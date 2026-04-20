import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTrack } from "@/context/TrackContext";

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const {
    syncStatus,
    lastSyncError,
    lastSyncedAt,
    syncNow,
    tracks,
    photos,
    backupCounts,
    retryFailedUploads,
  } = useTrack();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const totalPhotos = photos.filter((p) => !p.deleted).length;
  const hasFailures = backupCounts.failed > 0;
  const isUploading = backupCounts.uploading > 0;

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

      <ScrollView contentContainerStyle={styles.content}>
        {!isSignedIn ? (
          <>
            <View
              style={[
                styles.heroIcon,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Ionicons name="cloud-outline" size={44} color={colors.primary} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Back up your tracks
            </Text>
            <Text style={[styles.heroText, { color: colors.mutedForeground }]}>
              Sign in to sync your tracks and photos to the cloud. Switch phones
              or reinstall the app — your history comes with you.
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
            <Pressable
              testID="account-signup"
              onPress={() => router.push("/sign-up" as Href)}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
                Create an account
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Ionicons name="person" size={28} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, { color: colors.foreground }]}>
                  {user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
                </Text>
                <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>
                  Cloud backup is on
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.statsRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.statCol}>
                <Text style={[styles.statNum, { color: colors.foreground }]}>
                  {tracks.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Tracks
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statNum, { color: colors.foreground }]}>
                  {totalPhotos}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Photos
                </Text>
              </View>
            </View>

            <View
              testID="account-backup-card"
              style={[
                styles.syncCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.syncHeader}>
                <Ionicons
                  name={
                    hasFailures
                      ? "cloud-offline"
                      : isUploading
                        ? "cloud-upload"
                        : "cloud-done"
                  }
                  size={18}
                  color={hasFailures ? colors.destructive : colors.primary}
                />
                <Text style={[styles.syncTitle, { color: colors.foreground }]}>
                  Photo backup
                </Text>
              </View>
              <Text
                testID="account-backup-summary"
                style={[styles.syncMeta, { color: colors.mutedForeground }]}
              >
                {backupCounts.backedUp} of {backupCounts.total} photos backed up
              </Text>
              {(isUploading || backupCounts.pending > 0) && (
                <Text style={[styles.syncMeta, { color: colors.mutedForeground }]}>
                  {isUploading
                    ? `Uploading ${backupCounts.uploading}…`
                    : `${backupCounts.pending} waiting to upload`}
                </Text>
              )}
              {hasFailures && (
                <Text style={[styles.syncError, { color: colors.destructive }]}>
                  {backupCounts.failed} photo
                  {backupCounts.failed === 1 ? "" : "s"} failed to back up
                </Text>
              )}
              {hasFailures && (
                <Pressable
                  testID="account-retry-failed"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    void retryFailedUploads();
                  }}
                  disabled={isUploading}
                  style={({ pressed }) => [
                    styles.syncBtn,
                    {
                      backgroundColor: colors.destructive,
                      opacity: isUploading ? 0.5 : pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={16} color="#fff" />
                      <Text style={[styles.syncBtnText, { color: "#fff" }]}>
                        Retry failed uploads
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            <View
              style={[
                styles.syncCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.syncHeader}>
                <Ionicons
                  name={
                    syncStatus === "syncing"
                      ? "sync"
                      : syncStatus === "error"
                        ? "alert-circle"
                        : "checkmark-circle"
                  }
                  size={18}
                  color={
                    syncStatus === "error" ? colors.destructive : colors.primary
                  }
                />
                <Text style={[styles.syncTitle, { color: colors.foreground }]}>
                  {syncStatus === "syncing"
                    ? "Syncing…"
                    : syncStatus === "error"
                      ? "Sync issue"
                      : "Up to date"}
                </Text>
              </View>
              <Text style={[styles.syncMeta, { color: colors.mutedForeground }]}>
                Last sync: {formatRelative(lastSyncedAt)}
              </Text>
              {lastSyncError && (
                <Text style={[styles.syncError, { color: colors.destructive }]}>
                  {lastSyncError}
                </Text>
              )}
              <Pressable
                testID="account-sync-now"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  void syncNow();
                }}
                disabled={syncStatus === "syncing"}
                style={({ pressed }) => [
                  styles.syncBtn,
                  {
                    backgroundColor: colors.secondary,
                    opacity:
                      syncStatus === "syncing" ? 0.5 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                {syncStatus === "syncing" ? (
                  <ActivityIndicator color={colors.foreground} size="small" />
                ) : (
                  <>
                    <Ionicons name="sync" size={16} color={colors.foreground} />
                    <Text style={[styles.syncBtnText, { color: colors.foreground }]}>
                      Sync now
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            <Pressable
              testID="account-signout"
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                await signOut();
                router.back();
              }}
              style={({ pressed }) => [
                styles.signoutBtn,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.signoutText, { color: colors.destructive }]}>
                Sign out
              </Text>
            </Pressable>

            <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
              Your photos remain on this device. Cloud copies let you restore
              them on a new phone.
            </Text>
          </>
        )}
      </ScrollView>
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
  content: { padding: 20, gap: 16, alignItems: "stretch" },
  heroIcon: {
    alignSelf: "center",
    width: 88,
    height: 88,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginTop: 8,
  },
  heroText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  primaryBtn: {
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
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
  },
  userName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  userMeta: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
  statCol: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth },
  statNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  syncCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  syncHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  syncTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  syncMeta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  syncError: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  syncBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  syncBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  signoutBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  signoutText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  footnote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
});
