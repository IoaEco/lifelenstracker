import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { type TrackPhoto, useTrack } from "@/context/TrackContext";

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " · " + date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function BeforeAfterSlider({ firstPhoto, lastPhoto }: { firstPhoto: TrackPhoto; lastPhoto: TrackPhoto }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const imageWidth = width - 32;
  const imageHeight = imageWidth * (4 / 3);
  const [sliderPos, setSliderPos] = useState(0.5);
  const panRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const newPos = Math.max(0, Math.min(1, (gestureState.moveX - 16) / imageWidth));
        setSliderPos(newPos);
      },
    })
  ).current;

  return (
    <View style={[styles.sliderContainer, { width: imageWidth, height: imageHeight }]}>
      <Image
        source={{ uri: firstPhoto.uri }}
        style={[styles.sliderImageBase, { width: imageWidth, height: imageHeight }]}
        contentFit="cover"
      />
      <View
        style={[
          styles.sliderOverlay,
          { width: imageWidth * sliderPos, height: imageHeight, overflow: "hidden" },
        ]}
      >
        <Image
          source={{ uri: lastPhoto.uri }}
          style={{ width: imageWidth, height: imageHeight }}
          contentFit="cover"
        />
      </View>
      <View
        style={[styles.sliderDivider, { left: imageWidth * sliderPos - 1, height: imageHeight, backgroundColor: "#fff" }]}
        {...panRef.panHandlers}
      >
        <View style={[styles.sliderHandle, { backgroundColor: "#fff" }]}>
          <Ionicons name="chevron-back" size={10} color="#000" />
          <Ionicons name="chevron-forward" size={10} color="#000" />
        </View>
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>BEFORE</Text>
        <Text style={styles.sliderLabel}>AFTER</Text>
      </View>
    </View>
  );
}

function PhotoItem({ photo }: { photo: TrackPhoto }) {
  const colors = useColors();
  return (
    <View style={[styles.photoItem, { borderColor: colors.border }]}>
      <Image
        source={{ uri: photo.uri }}
        style={[styles.photoImage, { backgroundColor: colors.muted }]}
        contentFit="cover"
      />
      <View style={styles.photoMeta}>
        <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
        <Text style={[styles.photoDate, { color: colors.mutedForeground }]}>
          {formatDateTime(photo.takenAt)}
        </Text>
        {photo.tilt && (
          <View style={styles.tiltBadge}>
            <Ionicons name="phone-portrait-outline" size={10} color={colors.mutedForeground} />
            <Text style={[styles.tiltText, { color: colors.mutedForeground }]}>
              x:{photo.tilt.x.toFixed(1)} y:{photo.tilt.y.toFixed(1)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TrackDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tracks, deleteTrack, getTrackPhotos } = useTrack();

  const track = tracks.find((t) => t.id === id);
  const trackPhotos = getTrackPhotos(id ?? "");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  if (!track) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Track not found</Text>
        </View>
      </View>
    );
  }

  function handleDelete() {
    Alert.alert(
      "Delete Track",
      `Delete "${track!.title}" and all its photos? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteTrack(track!.id);
            router.back();
          },
        },
      ]
    );
  }

  function handleCamera() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/camera?trackId=${track!.id}`);
  }

  const firstPhoto = trackPhotos.length > 0 ? trackPhotos[0] : null;
  const lastPhoto = trackPhotos.length > 1 ? trackPhotos[trackPhotos.length - 1] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "20" }]}>
            <Ionicons name={track.iconName} size={18} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {track.title}
          </Text>
        </View>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={trackPhotos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PhotoItem photo={item} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding + 100 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        ListHeaderComponent={
          <>
            {/* Description */}
            {track.description ? (
              <Text style={[styles.description, { color: colors.mutedForeground }]}>
                {track.description}
              </Text>
            ) : null}

            {/* Before/After Comparison */}
            {firstPhoto && lastPhoto ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Before vs. After
                </Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  Drag to compare
                </Text>
                <BeforeAfterSlider firstPhoto={firstPhoto} lastPhoto={lastPhoto} />
              </View>
            ) : null}

            {/* Timeline header */}
            {trackPhotos.length > 0 ? (
              <Text style={[styles.sectionTitle, styles.timelineHeader, { color: colors.foreground }]}>
                Timeline · {trackPhotos.length} photos
              </Text>
            ) : null}

            {/* Empty state */}
            {trackPhotos.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                  <Ionicons name="camera-outline" size={40} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No photos yet
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Tap the camera button to capture your first photo
                </Text>
              </View>
            ) : null}
          </>
        }
      />

      {/* Floating Camera Button */}
      <View
        style={[
          styles.cameraButtonWrap,
          { paddingBottom: bottomPadding + 16 },
        ]}
      >
        <TouchableOpacity
          testID="open-camera-button"
          onPress={handleCamera}
          style={[styles.cameraButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={26} color="#000" />
          <Text style={styles.cameraButtonText}>
            {trackPhotos.length === 0 ? "Take First Photo" : "Take Next Photo"}
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  deleteBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 8,
  },
  section: {
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  timelineHeader: {
    marginTop: 8,
    marginBottom: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  photoItem: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  photoImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  photoMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: 10,
  },
  photoDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  tiltBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  tiltText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  cameraButtonWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  cameraButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraButtonText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  sliderContainer: {
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    alignSelf: "center",
  },
  sliderImageBase: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  sliderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  sliderDivider: {
    position: "absolute",
    top: 0,
    width: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderHandle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderLabels: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  sliderLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
});
