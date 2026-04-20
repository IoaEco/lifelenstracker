import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Directory, File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAccelerometer } from "@/hooks/useAccelerometer";
import { useTrack } from "@/context/TrackContext";

// Native-only: rule of thirds grid overlay
function RuleOfThirdsGrid() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={gridStyles.horizontal1} />
      <View style={gridStyles.horizontal2} />
      <View style={gridStyles.vertical1} />
      <View style={gridStyles.vertical2} />
    </View>
  );
}

const gridStyles = StyleSheet.create({
  horizontal1: {
    position: "absolute",
    top: "33.33%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  horizontal2: {
    position: "absolute",
    top: "66.66%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  vertical1: {
    position: "absolute",
    left: "33.33%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  vertical2: {
    position: "absolute",
    left: "66.66%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});

// Native-only: bubble level tilt indicator
function TiltIndicator({ x, y }: { x: number; y: number }) {
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  const dx = clamp(x * 30, -28, 28);
  const dy = clamp(-y * 30, -28, 28);
  const isLevel = Math.abs(x) < 0.05 && Math.abs(y) < 0.05;

  return (
    <View style={tiltStyles.container} pointerEvents="none">
      <View style={tiltStyles.ring}>
        <View
          style={[
            tiltStyles.bubble,
            {
              transform: [{ translateX: dx }, { translateY: dy }],
              backgroundColor: isLevel ? "#00FF88" : "rgba(255,255,255,0.85)",
            },
          ]}
        />
      </View>
      {isLevel ? <Text style={tiltStyles.levelText}>LEVEL</Text> : null}
    </View>
  );
}

const tiltStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 4,
  },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  levelText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#00FF88",
    letterSpacing: 1,
  },
});

export default function CameraScreen() {
  useColors(); // keep hook call for consistency
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const { tracks, getLatestPhoto, addPhoto } = useTrack();
  const [permission, requestPermission] = useCameraPermissions();
  const [overlayOpacity, setOverlayOpacity] = useState(0.45);
  const [showGrid, setShowGrid] = useState(true);
  const accel = useAccelerometer();
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingTilt, setPendingTilt] = useState<{ x: number; y: number; z: number } | null>(null);
  const [measurementInput, setMeasurementInput] = useState("");
  const [savingPending, setSavingPending] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const shutterScale = useSharedValue(1);

  const track = trackId ? tracks.find((t) => t.id === trackId) : null;
  const measurement = track?.measurement ?? null;
  const previousPhoto = trackId ? getLatestPhoto(trackId) : null;
  // Previous-photo overlay is only shown on native (camera overlay requires real camera feed context)
  const showOverlay =
    Platform.OS !== "web" && previousPhoto !== null && overlayOpacity > 0;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    shutterScale.value = withSpring(0.9, { damping: 8 }, () => {
      shutterScale.value = withSpring(1);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      setCaptureError(null);
      const isWeb = Platform.OS === "web";
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        base64: isWeb,
      });
      if (!photo?.uri) {
        setCaptureError("Could not capture photo. Please try again.");
        return;
      }

      let permanentUri = photo.uri;

      if (isWeb) {
        // On web, the camera returns a blob: URL that becomes invalid after
        // a page reload. Persist the image as a base64 data URL so it
        // survives across sessions in storage.
        if (photo.base64) {
          permanentUri = `data:image/jpeg;base64,${photo.base64}`;
        } else {
          const res = await fetch(photo.uri);
          const blob = await res.blob();
          permanentUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        }
      } else {
        // On native, the camera writes to a cache/temp directory whose URI
        // can be invalidated between sessions. Copy into the app's document
        // directory so the file is guaranteed to exist when reopened.
        const dir = new Directory(Paths.document, "lifelens");
        if (!dir.exists) dir.create({ intermediates: true });
        const dest = new File(dir, `${Date.now()}.jpg`);
        const src = new File(photo.uri);
        src.copy(dest);
        permanentUri = dest.uri;
      }

      const tilt = Platform.OS !== "web" ? accel : null;

      if (measurement) {
        // Enter review mode so the user can attach a measurement value.
        setPendingUri(permanentUri);
        setPendingTilt(tilt);
        setMeasurementInput("");
      } else {
        await addPhoto({
          trackId: trackId ?? "",
          uri: permanentUri,
          tilt,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      }
    } catch {
      setCaptureError("Save failed. Check storage permissions and try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCapturing(false);
    }
  }, [cameraRef, capturing, trackId, accel, addPhoto, shutterScale, measurement]);

  const savePending = useCallback(
    async (withValue: boolean) => {
      if (!pendingUri || savingPending) return;
      setSavingPending(true);
      try {
        let value: number | null = null;
        if (withValue) {
          const trimmed = measurementInput.trim().replace(",", ".");
          const parsed = trimmed.length > 0 ? Number(trimmed) : NaN;
          if (!Number.isFinite(parsed)) {
            setCaptureError("Please enter a valid number.");
            return;
          }
          value = parsed;
        }
        await addPhoto({
          trackId: trackId ?? "",
          uri: pendingUri,
          tilt: pendingTilt,
          measurementValue: value,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } catch {
        setCaptureError("Save failed. Please try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setSavingPending(false);
      }
    },
    [pendingUri, pendingTilt, measurementInput, savingPending, addPhoto, trackId],
  );

  const discardPending = useCallback(() => {
    setPendingUri(null);
    setPendingTilt(null);
    setMeasurementInput("");
    setCaptureError(null);
  }, []);

  const shutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#00D4FF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: "#000", paddingTop: topPad },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeBtn, { top: topPad + 8 }]}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.permIcon}>
          <Ionicons name="camera-outline" size={48} color="#00D4FF" />
        </View>
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permText}>
          LifeLens needs camera access to capture your progress photos
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity
            onPress={requestPermission}
            style={styles.permButton}
            activeOpacity={0.8}
          >
            <Text style={styles.permButtonText}>Allow Camera</Text>
          </TouchableOpacity>
        ) : Platform.OS !== "web" ? (
          <TouchableOpacity
            onPress={() => {
              try {
                Linking.openSettings();
              } catch {
                // settings not available
              }
            }}
            style={styles.permButton}
            activeOpacity={0.8}
          >
            <Text style={styles.permButtonText}>Open Settings</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const cameraHeight = height - bottomPad - 130 - topPad;

  if (pendingUri && measurement) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: "#000" }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.reviewHeader, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={discardPending} style={styles.controlBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.reviewTitle}>Review</Text>
          <View style={{ width: 40 }} />
        </View>
        <Image
          source={{ uri: pendingUri }}
          style={styles.reviewImage}
          contentFit="cover"
        />
        <View style={[styles.reviewBottom, { paddingBottom: bottomPad + 16 }]}>
          <Text style={styles.reviewLabel}>{measurement.label.toUpperCase()}</Text>
          <View style={styles.reviewInputRow}>
            <TextInput
              testID="review-measurement-input"
              style={styles.reviewInput}
              value={measurementInput}
              onChangeText={(t) => {
                setMeasurementInput(t);
                if (captureError) setCaptureError(null);
              }}
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="decimal-pad"
              autoFocus
              maxLength={10}
            />
            {measurement.unit ? (
              <Text style={styles.reviewUnit}>{measurement.unit}</Text>
            ) : null}
          </View>
          {captureError ? (
            <Text style={styles.captureError}>{captureError}</Text>
          ) : null}
          <View style={styles.reviewActions}>
            <TouchableOpacity
              testID="review-skip-button"
              onPress={() => savePending(false)}
              disabled={savingPending}
              style={[styles.reviewBtn, styles.reviewBtnSecondary]}
              activeOpacity={0.8}
            >
              <Text style={styles.reviewBtnSecondaryText}>Skip value</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="review-save-button"
              onPress={() => savePending(true)}
              disabled={savingPending || !measurementInput.trim()}
              style={[
                styles.reviewBtn,
                styles.reviewBtnPrimary,
                {
                  opacity: !measurementInput.trim() || savingPending ? 0.5 : 1,
                },
              ]}
              activeOpacity={0.8}
            >
              {savingPending ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.reviewBtnPrimaryText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={[styles.camera, { height: cameraHeight }]}
        facing={facing}
      >
        {/* Previous photo overlay — native only */}
        {showOverlay && previousPhoto && (
          <Image
            source={{ uri: previousPhoto.uri }}
            style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity }]}
            contentFit="cover"
            pointerEvents="none"
          />
        )}

        {/* Rule of thirds grid */}
        {showGrid && <RuleOfThirdsGrid />}

        {/* Top controls */}
        <View style={[styles.topControls, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.controlBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.topRight}>
            <TouchableOpacity
              onPress={() => setShowGrid(!showGrid)}
              style={[styles.controlBtn, showGrid && styles.controlBtnActive]}
            >
              <Ionicons name="grid-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFacing(facing === "back" ? "front" : "back")}
              style={styles.controlBtn}
            >
              <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tilt indicator — native only */}
        {Platform.OS !== "web" && (
          <View style={styles.tiltWrap}>
            <TiltIndicator x={accel.x} y={accel.y} />
          </View>
        )}
      </CameraView>

      {/* Bottom controls */}
      <View style={[styles.bottomControls, { paddingBottom: bottomPad + 16 }]}>
        {/* Overlay opacity slider — native only */}
        {Platform.OS !== "web" && previousPhoto && (
          <View style={styles.opacityRow}>
            <Ionicons name="eye-off-outline" size={16} color="rgba(255,255,255,0.6)" />
            <View style={styles.sliderTrack}>
              <View
                style={[
                  styles.sliderFill,
                  { width: `${overlayOpacity * 100}%`, backgroundColor: "#00D4FF" },
                ]}
              />
              <Pressable
                style={styles.sliderHitArea}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderMove={(e) => {
                  const trackWidth = width - 80;
                  const newVal = Math.max(
                    0,
                    Math.min(1, e.nativeEvent.locationX / trackWidth)
                  );
                  setOverlayOpacity(newVal);
                }}
              />
              <View
                style={[
                  styles.sliderThumb,
                  { left: `${overlayOpacity * 100}%`, backgroundColor: "#00D4FF" },
                ]}
              />
            </View>
            <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.6)" />
          </View>
        )}

        {captureError && (
          <Text style={styles.captureError}>{captureError}</Text>
        )}

        {!captureError && !previousPhoto && (
          <Text style={styles.firstPhotoHint}>First photo for this track</Text>
        )}

        {!captureError && Platform.OS === "web" && previousPhoto && (
          <Text style={styles.firstPhotoHint}>
            Overlay available on iOS & Android
          </Text>
        )}

        {/* Shutter */}
        <Animated.View style={shutterStyle}>
          <TouchableOpacity
            testID="shutter-button"
            onPress={handleCapture}
            disabled={capturing}
            style={[styles.shutterButton, { opacity: capturing ? 0.6 : 1 }]}
            activeOpacity={0.85}
          >
            {capturing ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  closeBtn: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  permIcon: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: "rgba(0,212,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  permTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  permText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 22,
  },
  permButton: {
    backgroundColor: "#00D4FF",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 8,
  },
  permButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
  },
  camera: {
    width: "100%",
    overflow: "hidden",
  },
  topControls: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topRight: {
    flexDirection: "row",
    gap: 8,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnActive: {
    backgroundColor: "rgba(0,212,255,0.3)",
  },
  tiltWrap: {
    position: "absolute",
    bottom: 16,
    right: 16,
  },
  bottomControls: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 20,
    backgroundColor: "#0A0A0A",
  },
  opacityRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 10,
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    position: "relative",
    overflow: "visible",
  },
  sliderFill: {
    height: 4,
    borderRadius: 2,
  },
  sliderHitArea: {
    position: "absolute",
    top: -16,
    left: 0,
    right: 0,
    height: 36,
  },
  sliderThumb: {
    position: "absolute",
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  firstPhotoHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.3,
  },
  captureError: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#FF5555",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#00D4FF",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  reviewTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  reviewImage: {
    flex: 1,
    width: "100%",
    backgroundColor: "#111",
  },
  reviewBottom: {
    paddingHorizontal: 24,
    paddingTop: 18,
    backgroundColor: "#0A0A0A",
    gap: 14,
  },
  reviewLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
  },
  reviewInputRow: {
    flexDirection: "row",
    alignItems: "baseline",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.2)",
    paddingBottom: 6,
    gap: 8,
  },
  reviewInput: {
    flex: 1,
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    paddingVertical: 0,
  },
  reviewUnit: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },
  reviewActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  reviewBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBtnSecondary: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  reviewBtnSecondaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  reviewBtnPrimary: {
    backgroundColor: "#00D4FF",
  },
  reviewBtnPrimaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
  },
});
