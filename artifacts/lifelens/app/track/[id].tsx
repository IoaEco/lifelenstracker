import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { decode as decodeJpeg } from "jpeg-js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot, { captureRef } from "react-native-view-shot";

import { useColors } from "@/hooks/useColors";
import { MeasurementPanel, formatMeasurementValue, formatDelta } from "@/components/MeasurementPanel";
import { EditPhotoMeasurementSheet } from "@/components/EditPhotoMeasurementSheet";
import { MeasureFromPhotoModal } from "@/components/MeasureFromPhotoModal";
import { TrackMeasurementSettingsModal } from "@/components/TrackMeasurementSettingsModal";
import type { Measurement } from "@/context/TrackContext";
import {
  type PhotoBackupStatus,
  type TrackPhoto,
  type PhotoSource,
  useTrack,
} from "@/context/TrackContext";

const MAX_GRID_PHOTOS = 6;

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

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type CompareMode = "slider" | "grid";

function BeforeAfterSlider({
  leftPhoto,
  rightPhoto,
  resolveSrc,
  onChangeLeft,
  onChangeRight,
  measurement,
}: {
  leftPhoto: TrackPhoto;
  rightPhoto: TrackPhoto;
  resolveSrc: (p: TrackPhoto) => PhotoSource;
  onChangeLeft: () => void;
  onChangeRight: () => void;
  measurement: Measurement | null;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const imageWidth = Math.min(width - 32, 600);
  const imageHeight = imageWidth * (4 / 3);
  const [sliderPos, setSliderPos] = useState(0.5);
  const containerLeftRef = useRef(0);
  const containerWidthRef = useRef(imageWidth);
  containerWidthRef.current = imageWidth;

  const panRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const w = containerWidthRef.current || 1;
        const px = evt.nativeEvent.pageX - containerLeftRef.current;
        setSliderPos(Math.max(0, Math.min(1, px / w)));
      },
      onPanResponderMove: (evt) => {
        const w = containerWidthRef.current || 1;
        const px = evt.nativeEvent.pageX - containerLeftRef.current;
        setSliderPos(Math.max(0, Math.min(1, px / w)));
      },
    })
  ).current;

  const sliderContainerRef = useRef<View>(null);
  const updateContainerLeft = () => {
    sliderContainerRef.current?.measureInWindow((x) => {
      containerLeftRef.current = x;
    });
  };

  return (
    <View style={{ alignItems: "center" }}>
      <View
        ref={sliderContainerRef}
        onLayout={updateContainerLeft}
        style={[styles.sliderContainer, { width: imageWidth, height: imageHeight }]}
      >
        <Image
          source={resolveSrc(leftPhoto)}
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
            source={resolveSrc(rightPhoto)}
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
      </View>

      {/* Swappable date chips below the slider so they don't conflict with the drag handle */}
      <View style={[styles.swapChipRow, { width: imageWidth }]}>
        <TouchableOpacity
          onPress={onChangeLeft}
          style={[styles.swapChip, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.swapChipLabel, { color: colors.mutedForeground }]}>BEFORE</Text>
          <Text style={[styles.swapChipDate, { color: colors.foreground }]} numberOfLines={1}>
            {formatShortDate(leftPhoto.takenAt)}
          </Text>
          {measurement ? (
            <Text
              testID="before-chip-value"
              style={[styles.swapChipValue, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {leftPhoto.measurementValue != null
                ? formatMeasurementValue(leftPhoto.measurementValue, measurement.unit)
                : "—"}
            </Text>
          ) : null}
          <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onChangeRight}
          style={[styles.swapChip, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.swapChipLabel, { color: colors.mutedForeground }]}>AFTER</Text>
          <Text style={[styles.swapChipDate, { color: colors.foreground }]} numberOfLines={1}>
            {formatShortDate(rightPhoto.takenAt)}
          </Text>
          {measurement ? (
            <Text
              testID="after-chip-value"
              style={[styles.swapChipValue, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {rightPhoto.measurementValue != null
                ? formatMeasurementValue(rightPhoto.measurementValue, measurement.unit)
                : "—"}
            </Text>
          ) : null}
          <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {measurement &&
      leftPhoto.measurementValue != null &&
      rightPhoto.measurementValue != null ? (
        <View
          testID="compare-delta"
          style={[
            styles.compareDelta,
            { backgroundColor: colors.primary + "18", borderColor: colors.primary + "55" },
          ]}
        >
          <Ionicons name="trending-up-outline" size={14} color={colors.primary} />
          <Text style={[styles.compareDeltaText, { color: colors.foreground }]}>
            {formatDelta(
              rightPhoto.measurementValue - leftPhoto.measurementValue,
              measurement.unit,
            )}{" "}
            · {measurement.label.toLowerCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function GridCompare({
  selectedPhotos,
  resolveSrc,
  onReplace,
  onRemove,
  onAdd,
  canAdd,
  canRemove,
  measurement,
}: {
  selectedPhotos: TrackPhoto[];
  resolveSrc: (p: TrackPhoto) => PhotoSource;
  onReplace: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  canAdd: boolean;
  canRemove: boolean;
  measurement: Measurement | null;
}) {
  const colors = useColors();
  const tileWidth = 140;
  const tileHeight = tileWidth * (4 / 3);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.gridContent}
    >
      {selectedPhotos.map((photo, idx) => (
        <View
          key={photo.id}
          style={[styles.gridTile, { width: tileWidth, borderColor: colors.border }]}
        >
          <Pressable onPress={() => onReplace(idx)} style={{ width: tileWidth, height: tileHeight }}>
            <Image
              source={resolveSrc(photo)}
              style={{ width: tileWidth, height: tileHeight, backgroundColor: colors.muted }}
              contentFit="cover"
            />
            <View style={styles.gridIndexBadge}>
              <Text style={styles.gridIndexText}>{idx + 1}</Text>
            </View>
          </Pressable>
          <View style={[styles.gridTileMeta, { backgroundColor: colors.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.gridTileDate, { color: colors.foreground }]} numberOfLines={1}>
                {formatShortDate(photo.takenAt)}
              </Text>
              {measurement ? (
                <Text
                  style={[styles.gridTileValue, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {photo.measurementValue != null
                    ? formatMeasurementValue(photo.measurementValue, measurement.unit)
                    : "—"}
                </Text>
              ) : null}
            </View>
            {canRemove ? (
              <TouchableOpacity onPress={() => onRemove(idx)} hitSlop={6}>
                <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}

      {canAdd ? (
        <TouchableOpacity
          onPress={onAdd}
          style={[
            styles.gridAddTile,
            {
              width: tileWidth,
              height: tileHeight + 36,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
          <Text style={[styles.gridAddText, { color: colors.mutedForeground }]}>Add photo</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function PhotoPickerModal({
  visible,
  onClose,
  photos,
  resolveSrc,
  onSelect,
  excludeIds,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  photos: TrackPhoto[];
  resolveSrc: (p: TrackPhoto) => PhotoSource;
  onSelect: (photo: TrackPhoto) => void;
  excludeIds?: string[];
  title: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cols = 3;
  const gap = 8;
  const horizontalPadding = 16;
  const tileSize = Math.floor(
    (Math.min(width, 600) - horizontalPadding * 2 - gap * (cols - 1)) / cols,
  );
  const excludeSet = new Set(excludeIds ?? []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.pickerOverlay}>
        <View
          style={[
            styles.pickerContainer,
            { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={photos}
            keyExtractor={(item) => item.id}
            numColumns={cols}
            contentContainerStyle={{ padding: horizontalPadding, gap }}
            columnWrapperStyle={{ gap }}
            renderItem={({ item, index }) => {
              const disabled = excludeSet.has(item.id);
              return (
                <Pressable
                  onPress={() => {
                    if (disabled) return;
                    onSelect(item);
                  }}
                  style={({ pressed }) => [
                    {
                      width: tileSize,
                      opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Image
                    source={resolveSrc(item)}
                    style={{
                      width: tileSize,
                      height: tileSize,
                      borderRadius: 10,
                      backgroundColor: colors.muted,
                    }}
                    contentFit="cover"
                  />
                  <Text
                    style={[styles.pickerTileLabel, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    #{index + 1} · {formatShortDate(item.takenAt)}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function BackupBadge({
  status,
  onRetry,
  colors,
}: {
  status: PhotoBackupStatus;
  onRetry: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  if (status === "local-only") return null;

  let icon: React.ComponentProps<typeof Ionicons>["name"] = "cloud-outline";
  let label = "";
  let bg = "rgba(0,0,0,0.55)";
  let fg = "#fff";

  if (status === "backed-up") {
    icon = "cloud-done";
    label = "Backed up";
    bg = "rgba(16, 122, 87, 0.85)";
  } else if (status === "uploading") {
    icon = "cloud-upload";
    label = "Uploading…";
    bg = "rgba(0,0,0,0.65)";
  } else if (status === "failed") {
    icon = "cloud-offline";
    label = "Retry backup";
    bg = colors.destructive;
  } else if (status === "pending") {
    icon = "cloud-outline";
    label = "Waiting";
    bg = "rgba(0,0,0,0.55)";
  }

  const isInteractive = status === "failed";
  const Inner = (
    <View style={[styles.backupBadge, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={12} color={fg} />
      <Text style={[styles.backupBadgeText, { color: fg }]}>{label}</Text>
    </View>
  );
  if (isInteractive) {
    return (
      <TouchableOpacity
        testID="photo-retry-backup"
        onPress={onRetry}
        activeOpacity={0.8}
        style={styles.backupBadgeWrap}
      >
        {Inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.backupBadgeWrap}>{Inner}</View>;
}

function PhotoItem({
  photo,
  measurement,
  onPress,
}: {
  photo: TrackPhoto;
  measurement: Measurement | null;
  onPress: (photo: TrackPhoto) => void;
}) {
  const colors = useColors();
  const { resolvePhotoSource, getPhotoBackupStatus, retryPhotoUpload } = useTrack();
  const status = getPhotoBackupStatus(photo);
  const showValueRow = !!measurement;
  return (
    <Pressable
      testID={`photo-item-${photo.id}`}
      onPress={() => onPress(photo)}
      style={({ pressed }) => [
        styles.photoItem,
        { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View>
        <Image
          source={resolvePhotoSource(photo)}
          style={[styles.photoImage, { backgroundColor: colors.muted }]}
          contentFit="cover"
        />
        <BackupBadge
          status={status}
          colors={colors}
          onRetry={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            void retryPhotoUpload(photo.id);
          }}
        />
        {showValueRow ? (
          <View
            testID={`photo-value-badge-${photo.id}`}
            style={[
              styles.photoValueBadge,
              {
                backgroundColor:
                  photo.measurementValue != null
                    ? colors.primary + "E6"
                    : "rgba(0,0,0,0.55)",
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {photo.measurementValue != null && photo.measuredVisually ? (
                <Ionicons
                  testID={`photo-measured-visually-${photo.id}`}
                  name="resize-outline"
                  size={11}
                  color="#000"
                />
              ) : null}
              <Text
                style={[
                  styles.photoValueText,
                  {
                    color: photo.measurementValue != null ? "#000" : "#fff",
                  },
                ]}
                numberOfLines={1}
              >
                {photo.measurementValue != null
                  ? formatMeasurementValue(photo.measurementValue, measurement!.unit)
                  : `Add ${measurement!.label.toLowerCase()}`}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
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
    </Pressable>
  );
}

type PickerTarget =
  | { kind: "slider-left" }
  | { kind: "slider-right" }
  | { kind: "grid-replace"; index: number }
  | { kind: "grid-add" };

function ShareComposite({
  innerRef,
  title,
  leftPhoto,
  rightPhoto,
  resolveSrc,
}: {
  innerRef: React.RefObject<ViewShot | null>;
  title: string;
  leftPhoto: TrackPhoto;
  rightPhoto: TrackPhoto;
  resolveSrc: (p: TrackPhoto) => PhotoSource;
}) {
  const tileWidth = 540;
  const tileHeight = tileWidth * (4 / 3);
  return (
    <View pointerEvents="none" style={styles.shareOffscreen}>
      <ViewShot ref={innerRef} options={{ format: "jpg", quality: 0.95 }}>
        <View style={styles.shareCanvas}>
          <Text style={styles.shareTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.sharePair}>
            <View style={styles.shareTile}>
              <Image
                source={resolveSrc(leftPhoto)}
                style={{ width: tileWidth, height: tileHeight, backgroundColor: "#111" }}
                contentFit="cover"
              />
              <View style={styles.shareTileLabel}>
                <Text style={styles.shareTileLabelText}>BEFORE</Text>
              </View>
              <Text style={styles.shareTileDate}>{formatShortDate(leftPhoto.takenAt)}</Text>
            </View>
            <View style={styles.shareTile}>
              <Image
                source={resolveSrc(rightPhoto)}
                style={{ width: tileWidth, height: tileHeight, backgroundColor: "#111" }}
                contentFit="cover"
              />
              <View style={styles.shareTileLabel}>
                <Text style={styles.shareTileLabelText}>AFTER</Text>
              </View>
              <Text style={styles.shareTileDate}>{formatShortDate(rightPhoto.takenAt)}</Text>
            </View>
          </View>
          <Text style={styles.shareFooter}>Tracked with LifeLens</Text>
        </View>
      </ViewShot>
    </View>
  );
}

const TIMELAPSE_FRAME_WIDTH = 360;
const TIMELAPSE_FRAME_HEIGHT = 480;

function TimelapseFrame({
  innerRef,
  title,
  photo,
  index,
  total,
  resolveSrc,
}: {
  innerRef: React.RefObject<ViewShot | null>;
  title: string;
  photo: TrackPhoto | null;
  index: number;
  total: number;
  resolveSrc: (p: TrackPhoto) => PhotoSource;
}) {
  return (
    <View pointerEvents="none" style={styles.shareOffscreen}>
      <ViewShot ref={innerRef} options={{ format: "jpg", quality: 0.92 }}>
        <View style={styles.timelapseCanvas}>
          {photo ? (
            <Image
              source={resolveSrc(photo)}
              style={{
                width: TIMELAPSE_FRAME_WIDTH,
                height: TIMELAPSE_FRAME_HEIGHT,
                backgroundColor: "#000",
              }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: TIMELAPSE_FRAME_WIDTH,
                height: TIMELAPSE_FRAME_HEIGHT,
                backgroundColor: "#000",
              }}
            />
          )}
          <View style={styles.timelapseTopBar}>
            <Text style={styles.timelapseTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.timelapseCounter}>
              {index + 1} / {total}
            </Text>
          </View>
          <View style={styles.timelapseBottomBar}>
            <Text style={styles.timelapseDate}>
              {photo ? formatShortDate(photo.takenAt) : ""}
            </Text>
            <Text style={styles.timelapseFooter}>LifeLens</Text>
          </View>
        </View>
      </ViewShot>
    </View>
  );
}

export default function TrackDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    tracks,
    deleteTrack,
    getTrackPhotos,
    resolvePhotoSource,
    updateTrackMeasurement,
    updatePhotoMeasurement,
    updateTrackLastReference,
  } = useTrack();
  const shareRef = useRef<ViewShot | null>(null);
  const timelapseRef = useRef<ViewShot | null>(null);
  const [sharing, setSharing] = useState(false);
  const [savingToPhotos, setSavingToPhotos] = useState(false);
  const [timelapseFrameIdx, setTimelapseFrameIdx] = useState<number | null>(null);
  const [exportingTimelapse, setExportingTimelapse] = useState(false);
  const [timelapseProgress, setTimelapseProgress] = useState(0);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({
    granularPermissions: ["photo"],
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<TrackPhoto | null>(null);
  const [measuringPhoto, setMeasuringPhoto] = useState<TrackPhoto | null>(null);

  const track = tracks.find((t) => t.id === id);
  const trackPhotos = getTrackPhotos(id ?? "");
  const measurement = track?.measurement ?? null;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  // Comparison selection state
  const [compareMode, setCompareMode] = useState<CompareMode>("slider");
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [gridIds, setGridIds] = useState<string[]>([]);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const photoIdsKey = trackPhotos.map((p) => p.id).join(",");

  // Initialize / repair selections whenever the underlying photo set changes.
  useEffect(() => {
    if (trackPhotos.length < 2) {
      setLeftId(null);
      setRightId(null);
      setGridIds([]);
      return;
    }
    const ids = new Set(trackPhotos.map((p) => p.id));
    const firstId = trackPhotos[0].id;
    const lastId = trackPhotos[trackPhotos.length - 1].id;

    // Repair slider sides; ensure they're never the same photo.
    let nextLeft = leftId && ids.has(leftId) ? leftId : firstId;
    let nextRight = rightId && ids.has(rightId) ? rightId : lastId;
    if (nextLeft === nextRight) {
      const fallback = trackPhotos.find((p) => p.id !== nextLeft);
      if (fallback) nextRight = fallback.id;
    }
    if (nextLeft !== leftId) setLeftId(nextLeft);
    if (nextRight !== rightId) setRightId(nextRight);

    setGridIds((prev) => {
      const filtered = prev.filter((pid) => ids.has(pid));
      if (filtered.length >= 2) return filtered;
      if (firstId !== lastId) return [firstId, lastId];
      return filtered;
    });
  }, [photoIdsKey, trackPhotos.length]);

  const photoById = useMemo(() => {
    const m = new Map<string, TrackPhoto>();
    for (const p of trackPhotos) m.set(p.id, p);
    return m;
  }, [trackPhotos]);

  const leftPhoto = leftId ? photoById.get(leftId) ?? null : null;
  const rightPhoto = rightId ? photoById.get(rightId) ?? null : null;
  const gridPhotos = gridIds
    .map((pid) => photoById.get(pid))
    .filter((p): p is TrackPhoto => !!p);

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

  function handlePickerSelect(photo: TrackPhoto) {
    if (!pickerTarget) return;
    if (pickerTarget.kind === "slider-left") {
      setLeftId(photo.id);
    } else if (pickerTarget.kind === "slider-right") {
      setRightId(photo.id);
    } else if (pickerTarget.kind === "grid-replace") {
      setGridIds((prev) => prev.map((pid, i) => (i === pickerTarget.index ? photo.id : pid)));
    } else if (pickerTarget.kind === "grid-add") {
      setGridIds((prev) => (prev.length < MAX_GRID_PHOTOS ? [...prev, photo.id] : prev));
    }
    setPickerTarget(null);
  }

  function pickerExcludeIds(): string[] {
    if (!pickerTarget) return [];
    if (pickerTarget.kind === "slider-left") return rightId ? [rightId] : [];
    if (pickerTarget.kind === "slider-right") return leftId ? [leftId] : [];
    if (pickerTarget.kind === "grid-add") return gridIds;
    if (pickerTarget.kind === "grid-replace") {
      return gridIds.filter((_, i) => i !== pickerTarget.index);
    }
    return [];
  }

  function pickerTitle(): string {
    if (!pickerTarget) return "Choose a photo";
    if (pickerTarget.kind === "slider-left") return "Choose the BEFORE photo";
    if (pickerTarget.kind === "slider-right") return "Choose the AFTER photo";
    if (pickerTarget.kind === "grid-add") return "Add a photo to compare";
    return "Choose a photo";
  }

  function handleRemoveGrid(index: number) {
    setGridIds((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  }

  const canShowComparison = trackPhotos.length >= 2 && !!leftPhoto && !!rightPhoto;
  const canShare = !!leftPhoto && !!rightPhoto;

  function handleSharePress() {
    if (!canShare || sharing || exportingTimelapse) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (trackPhotos.length < 2) {
      void handleShareStill();
      return;
    }
    Alert.alert(
      "Share track",
      "How would you like to share this track?",
      [
        {
          text: "Before & After image",
          onPress: () => void handleShareStill(),
        },
        {
          text: `Animated timelapse (${trackPhotos.length} photos)`,
          onPress: () => void handleShareTimelapse(),
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true },
    );
  }

  async function handleShareTimelapse() {
    if (exportingTimelapse || sharing) return;
    if (trackPhotos.length < 2) return;
    setExportingTimelapse(true);
    setTimelapseProgress(0);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
        return;
      }
      // Prefetch every photo in the track so the offscreen ViewShot has the
      // bitmap ready when we render each frame.
      try {
        await Image.prefetch(trackPhotos.map((p) => resolvePhotoSource(p).uri));
      } catch {
        // best-effort
      }

      const gif = GIFEncoder();
      const photos = trackPhotos;
      const isLong = photos.length >= 12;
      const baseDelay = isLong ? 350 : 600;

      for (let i = 0; i < photos.length; i++) {
        setTimelapseFrameIdx(i);
        // Allow React to re-render and the Image to settle before capture.
        await new Promise((r) => setTimeout(r, 220));
        if (!timelapseRef.current) {
          throw new Error("Timelapse renderer is not ready.");
        }
        const frameUri = await captureRef(timelapseRef.current, {
          format: "jpg",
          quality: 0.92,
          width: TIMELAPSE_FRAME_WIDTH,
          height: TIMELAPSE_FRAME_HEIGHT,
        });
        const frameFile = new File(frameUri);
        const jpegBytes = await frameFile.bytes();
        const decoded = decodeJpeg(jpegBytes, {
          useTArray: true,
          formatAsRGBA: true,
        });
        try {
          frameFile.delete();
        } catch {
          // ignore cleanup failures
        }
        const palette = quantize(decoded.data, 256);
        const indexed = applyPalette(decoded.data, palette);
        // First and last frames linger so the viewer can read them.
        const isEdge = i === 0 || i === photos.length - 1;
        gif.writeFrame(indexed, decoded.width, decoded.height, {
          palette,
          delay: isEdge ? baseDelay + 800 : baseDelay,
        });
        setTimelapseProgress((i + 1) / photos.length);
        // Yield to UI so the spinner can update.
        await new Promise((r) => setTimeout(r, 0));
      }
      gif.finish();
      const gifBytes = gif.bytes();

      const safeTitle = (track?.title ?? "track")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "track";
      const outFile = new File(
        Paths.cache,
        `lifelens-timelapse-${safeTitle}-${Date.now()}.gif`,
      );
      try {
        outFile.create({ overwrite: true });
      } catch {
        // already exists or directory present — write will overwrite
      }
      outFile.write(gifBytes);

      try {
        await Sharing.shareAsync(outFile.uri, {
          mimeType: "image/gif",
          dialogTitle: `${track!.title} — Timelapse`,
          UTI: "com.compuserve.gif",
        });
      } finally {
        // Best-effort cleanup so cached GIFs don't accumulate over time.
        try {
          outFile.delete();
        } catch {
          // ignore cleanup failures
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate timelapse";
      Alert.alert("Timelapse failed", message);
    } finally {
      setExportingTimelapse(false);
      setTimelapseFrameIdx(null);
      setTimelapseProgress(0);
    }
  }

  async function handleShareStill() {
    return handleShare();
  }

  async function handleShare() {
    if (!canShare || !leftPhoto || !rightPhoto || sharing) return;
    setSharing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
        return;
      }
      // Make sure both photo bitmaps are loaded before snapshotting.
      try {
        await Image.prefetch([
          resolvePhotoSource(leftPhoto).uri,
          resolvePhotoSource(rightPhoto).uri,
        ]);
      } catch {
        // best-effort; capture will still proceed
      }
      await new Promise((r) => setTimeout(r, 200));
      if (!shareRef.current) {
        Alert.alert("Share failed", "Image is not ready yet, please try again.");
        return;
      }
      const uri = await captureRef(shareRef.current, {
        format: "jpg",
        quality: 0.95,
      });
      await Sharing.shareAsync(uri, {
        mimeType: "image/jpeg",
        dialogTitle: `${track!.title} — Before & After`,
        UTI: "public.jpeg",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate image";
      Alert.alert("Share failed", message);
    } finally {
      setSharing(false);
    }
  }

  async function handleSaveToPhotos() {
    if (!canShare || !leftPhoto || !rightPhoto || savingToPhotos) return;
    setSavingToPhotos(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      let permission = mediaPermission;
      if (!permission || permission.status !== "granted") {
        permission = await requestMediaPermission();
      }
      if (!permission || permission.status !== "granted") {
        if (permission && !permission.canAskAgain) {
          Alert.alert(
            "Permission needed",
            "LifeLens needs permission to save photos to your library. Enable it in Settings.",
          );
        } else {
          Alert.alert(
            "Permission needed",
            "LifeLens needs permission to save photos to your library.",
          );
        }
        return;
      }

      try {
        await Image.prefetch([
          resolvePhotoSource(leftPhoto).uri,
          resolvePhotoSource(rightPhoto).uri,
        ]);
      } catch {
        // best-effort
      }
      await new Promise((r) => setTimeout(r, 200));
      if (!shareRef.current) {
        Alert.alert("Save failed", "Image is not ready yet, please try again.");
        return;
      }
      const uri = await captureRef(shareRef.current, {
        format: "jpg",
        quality: 0.95,
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(
        "Saved to Photos",
        Platform.OS === "ios"
          ? "Your before/after image was saved to your Photos library."
          : "Your before/after image was saved to your gallery.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save image";
      Alert.alert("Save failed", message);
    } finally {
      setSavingToPhotos(false);
    }
  }

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
        {canShare ? (
          <>
            <TouchableOpacity
              testID="save-to-photos-button"
              onPress={handleSaveToPhotos}
              disabled={savingToPhotos}
              style={[styles.headerIconBtn, savingToPhotos && styles.headerIconBtnDisabled]}
              accessibilityLabel="Save before and after to Photos"
            >
              <Ionicons
                name="download-outline"
                size={22}
                color={savingToPhotos ? colors.mutedForeground : colors.foreground}
              />
            </TouchableOpacity>
            <TouchableOpacity
              testID="share-track-button"
              onPress={handleSharePress}
              disabled={sharing || exportingTimelapse}
              style={[
                styles.headerIconBtn,
                (sharing || exportingTimelapse) && styles.headerIconBtnDisabled,
              ]}
              accessibilityLabel="Share this track"
            >
              <Ionicons
                name="share-outline"
                size={22}
                color={
                  sharing || exportingTimelapse
                    ? colors.mutedForeground
                    : colors.foreground
                }
              />
            </TouchableOpacity>
          </>
        ) : null}
        <TouchableOpacity
          testID="track-settings-button"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSettingsOpen(true);
          }}
          style={styles.headerIconBtn}
        >
          <Ionicons name="options-outline" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.headerIconBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      {canShare && leftPhoto && rightPhoto ? (
        <ShareComposite
          innerRef={shareRef}
          title={track.title}
          leftPhoto={leftPhoto}
          rightPhoto={rightPhoto}
          resolveSrc={resolvePhotoSource}
        />
      ) : null}

      {exportingTimelapse ? (
        <TimelapseFrame
          innerRef={timelapseRef}
          title={track.title}
          photo={
            timelapseFrameIdx != null
              ? trackPhotos[timelapseFrameIdx] ?? null
              : null
          }
          index={timelapseFrameIdx ?? 0}
          total={trackPhotos.length}
          resolveSrc={resolvePhotoSource}
        />
      ) : null}

      {exportingTimelapse ? (
        <Modal transparent animationType="fade" visible>
          <View style={styles.timelapseOverlay}>
            <View style={[styles.timelapseProgressCard, { backgroundColor: colors.card }]}>
              <Ionicons name="film-outline" size={28} color={colors.primary} />
              <Text style={[styles.timelapseProgressTitle, { color: colors.foreground }]}>
                Building timelapse…
              </Text>
              <Text style={[styles.timelapseProgressSub, { color: colors.mutedForeground }]}>
                {Math.round(timelapseProgress * 100)}% · frame{" "}
                {Math.min(
                  trackPhotos.length,
                  (timelapseFrameIdx ?? 0) + 1,
                )}{" "}
                of {trackPhotos.length}
              </Text>
              <View style={[styles.timelapseProgressTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.timelapseProgressFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${Math.round(timelapseProgress * 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <FlatList
        data={trackPhotos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PhotoItem
            photo={item}
            measurement={measurement}
            onPress={(p) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (measurement) {
                setEditingPhoto(p);
              } else {
                setSettingsOpen(true);
              }
            }}
          />
        )}
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

            {/* Comparison area */}
            {canShowComparison && leftPhoto && rightPhoto ? (
              <View style={styles.section}>
                <View style={styles.compareHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Compare
                  </Text>

                  {/* Mode toggle */}
                  <View style={[styles.segmented, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      onPress={() => setCompareMode("slider")}
                      style={[
                        styles.segmentBtn,
                        compareMode === "slider" && { backgroundColor: colors.primary },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={14}
                        color={compareMode === "slider" ? "#000" : colors.foreground}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          { color: compareMode === "slider" ? "#000" : colors.foreground },
                        ]}
                      >
                        Slider
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setCompareMode("grid")}
                      style={[
                        styles.segmentBtn,
                        compareMode === "grid" && { backgroundColor: colors.primary },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="grid-outline"
                        size={14}
                        color={compareMode === "grid" ? "#000" : colors.foreground}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          { color: compareMode === "grid" ? "#000" : colors.foreground },
                        ]}
                      >
                        Side-by-side
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  {compareMode === "slider"
                    ? "Drag the divider, or tap a date below to pick a different photo."
                    : `Scroll to see all ${gridPhotos.length} photos. Tap a tile to swap, or add up to ${MAX_GRID_PHOTOS}.`}
                </Text>

                {compareMode === "slider" ? (
                  <BeforeAfterSlider
                    leftPhoto={leftPhoto}
                    rightPhoto={rightPhoto}
                    resolveSrc={resolvePhotoSource}
                    onChangeLeft={() => setPickerTarget({ kind: "slider-left" })}
                    onChangeRight={() => setPickerTarget({ kind: "slider-right" })}
                    measurement={measurement}
                  />
                ) : (
                  <GridCompare
                    selectedPhotos={gridPhotos}
                    resolveSrc={resolvePhotoSource}
                    onReplace={(index) => setPickerTarget({ kind: "grid-replace", index })}
                    onRemove={handleRemoveGrid}
                    onAdd={() => setPickerTarget({ kind: "grid-add" })}
                    canAdd={gridPhotos.length < MAX_GRID_PHOTOS && gridPhotos.length < trackPhotos.length}
                    canRemove={gridPhotos.length > 2}
                    measurement={measurement}
                  />
                )}
              </View>
            ) : null}

            {/* Measurement panel */}
            {measurement ? (
              <MeasurementPanel
                measurement={measurement}
                photos={trackPhotos}
                onEditSettings={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSettingsOpen(true);
                }}
              />
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

      <PhotoPickerModal
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        photos={trackPhotos}
        resolveSrc={resolvePhotoSource}
        onSelect={handlePickerSelect}
        excludeIds={pickerExcludeIds()}
        title={pickerTitle()}
      />

      <TrackMeasurementSettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        measurement={measurement}
        onSave={async (next) => {
          if (!track) return;
          await updateTrackMeasurement(track.id, next);
        }}
      />

      {measurement ? (
        <EditPhotoMeasurementSheet
          visible={editingPhoto !== null}
          onClose={() => setEditingPhoto(null)}
          photo={editingPhoto}
          measurement={measurement}
          resolveSrc={resolvePhotoSource}
          onSave={async (value) => {
            if (!editingPhoto) return;
            await updatePhotoMeasurement(editingPhoto.id, value, {
              measuredVisually: false,
            });
          }}
          onMeasureFromPhoto={() => {
            const target = editingPhoto;
            if (!target) return;
            setEditingPhoto(null);
            setMeasuringPhoto(target);
          }}
        />
      ) : null}

      {measurement && track ? (
        <MeasureFromPhotoModal
          visible={measuringPhoto !== null}
          photoSource={measuringPhoto ? resolvePhotoSource(measuringPhoto) : null}
          measurementLabel={measurement.label}
          measurementUnit={measurement.unit}
          initialReferenceId={track.lastReferenceId ?? null}
          onClose={() => setMeasuringPhoto(null)}
          onAccept={async ({ value, referenceId }) => {
            const target = measuringPhoto;
            setMeasuringPhoto(null);
            if (!target) return;
            await updatePhotoMeasurement(target.id, value, {
              measuredVisually: true,
            });
            await updateTrackLastReference(track.id, referenceId);
          }}
        />
      ) : null}
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
  headerIconBtn: {
    padding: 4,
  },
  headerIconBtnDisabled: {
    opacity: 0.5,
  },
  shareOffscreen: {
    position: "absolute",
    top: -10000,
    left: 0,
    opacity: 0,
  },
  shareCanvas: {
    width: 1140,
    paddingHorizontal: 30,
    paddingTop: 28,
    paddingBottom: 24,
    backgroundColor: "#0b0b0c",
    alignItems: "center",
  },
  shareTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 20,
  },
  sharePair: {
    flexDirection: "row",
    gap: 12,
  },
  shareTile: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  shareTileLabel: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shareTileLabelText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  shareTileDate: {
    position: "absolute",
    bottom: 14,
    right: 14,
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  shareFooter: {
    marginTop: 16,
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  timelapseCanvas: {
    width: TIMELAPSE_FRAME_WIDTH,
    height: TIMELAPSE_FRAME_HEIGHT,
    backgroundColor: "#000",
    position: "relative",
  },
  timelapseTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  timelapseTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginRight: 8,
  },
  timelapseCounter: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  timelapseBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  timelapseDate: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  timelapseFooter: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
  },
  timelapseOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  timelapseProgressCard: {
    width: "100%",
    maxWidth: 320,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderRadius: 16,
    alignItems: "center",
    gap: 8,
  },
  timelapseProgressTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  timelapseProgressSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  timelapseProgressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  timelapseProgressFill: {
    height: 6,
    borderRadius: 999,
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
    marginBottom: 8,
  },
  compareHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  segmented: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  segmentText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  swapChipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 8,
  },
  swapChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  swapChipLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  swapChipDate: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  swapChipValue: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  compareDelta: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  compareDeltaText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  gridTileValue: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  photoValueBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: "75%",
  },
  photoValueText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  gridContent: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 4,
  },
  gridTile: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  gridIndexBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  gridIndexText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  gridTileMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  gridTileDate: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  gridAddTile: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  gridAddText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerContainer: {
    width: "100%",
    height: "80%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  pickerTileLabel: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
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
  backupBadgeWrap: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  backupBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  backupBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
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
});
