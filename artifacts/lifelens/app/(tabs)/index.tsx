import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NewTrackModal } from "@/components/NewTrackModal";
import { useColors } from "@/hooks/useColors";
import { type Track, useTrack } from "@/context/TrackContext";

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function TrackCard({ track }: { track: Track }) {
  const colors = useColors();
  const { getTrackPhotos } = useTrack();
  const trackPhotos = getTrackPhotos(track.id);
  const latestPhoto = trackPhotos.length > 0 ? trackPhotos[trackPhotos.length - 1] : null;
  const photoCount = trackPhotos.length;

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/track/${track.id}`);
  }

  return (
    <Pressable
      testID={`track-card-${track.id}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + "20" }]}>
        <Ionicons
          name={track.iconName as any}
          size={26}
          color={colors.primary}
        />
      </View>

      <View style={styles.cardInfo}>
        <Text
          style={[styles.cardTitle, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {track.title}
        </Text>
        {track.description ? (
          <Text
            style={[styles.cardDesc, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {track.description}
          </Text>
        ) : null}
        <View style={styles.cardMeta}>
          <Ionicons name="images-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {photoCount} {photoCount === 1 ? "photo" : "photos"}
          </Text>
          {latestPhoto && (
            <>
              <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {formatTimeAgo(latestPhoto.takenAt)}
              </Text>
            </>
          )}
        </View>
      </View>

      {latestPhoto ? (
        <Image
          source={{ uri: latestPhoto.uri }}
          style={[styles.thumbnail, { borderColor: colors.border }]}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.thumbnail,
            styles.thumbnailEmpty,
            { borderColor: colors.border, backgroundColor: colors.muted },
          ]}
        >
          <Ionicons name="camera-outline" size={18} color={colors.mutedForeground} />
        </View>
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tracks, loading } = useTrack();
  const [showModal, setShowModal] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPadding }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>LifeLens</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          </Text>
        </View>
        <TouchableOpacity
          testID="add-track-button"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowModal(true);
          }}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {tracks.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Ionicons name="aperture-outline" size={48} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Start your first track
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Create a track to begin documenting your journey with photos over time
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowModal(true);
            }}
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.emptyButtonText}>New Track</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TrackCard track={item} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPadding + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={tracks.length > 0}
        />
      )}

      <NewTrackModal
        visible={showModal}
        onClose={() => setShowModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  thumbnail: {
    width: 58,
    height: 58,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbnailEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
  },
});
