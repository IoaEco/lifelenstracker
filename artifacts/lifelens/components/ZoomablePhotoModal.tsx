import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PhotoSource } from "@/context/TrackContext";

const MIN_SCALE = 1;
const MAX_SCALE = 5;

export function ZoomablePhotoModal({
  visible,
  onClose,
  source,
  caption,
}: {
  visible: boolean;
  onClose: () => void;
  source: PhotoSource | null;
  caption?: string;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom + 8;

  const viewW = width;
  const viewH = height - topPad - bottomPad - 80;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  function reset() {
    scale.value = withTiming(1, { duration: 180 });
    savedScale.value = 1;
    tx.value = withTiming(0, { duration: 180 });
    ty.value = withTiming(0, { duration: 180 });
    savedTx.value = 0;
    savedTy.value = 0;
  }

  useEffect(() => {
    if (!visible) {
      scale.value = 1;
      savedScale.value = 1;
      tx.value = 0;
      ty.value = 0;
      savedTx.value = 0;
      savedTy.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const clampTranslate = (value: number, axisExtent: number, s: number) => {
    "worklet";
    const max = Math.max(0, (axisExtent * (s - 1)) / 2);
    return Math.max(-max, Math.min(max, value));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale));
      scale.value = next;
      tx.value = clampTranslate(savedTx.value, viewW, next);
      ty.value = clampTranslate(savedTy.value, viewH, next);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const s = scale.value;
      if (s <= 1) return;
      tx.value = clampTranslate(savedTx.value + e.translationX, viewW, s);
      ty.value = clampTranslate(savedTy.value + e.translationY, viewH, s);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1, { duration: 180 });
        tx.value = withTiming(0, { duration: 180 });
        ty.value = withTiming(0, { duration: 180 });
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        scale.value = withTiming(2.5, { duration: 180 });
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        testID="zoomable-photo-modal"
        style={[styles.container, { backgroundColor: "#000" }]}
      >
        <View style={[styles.header, { paddingTop: topPad }]}>
          <TouchableOpacity
            testID="zoom-close-button"
            onPress={onClose}
            style={styles.headerBtn}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {caption ?? ""}
          </Text>
          <TouchableOpacity
            testID="zoom-reset-button"
            onPress={reset}
            style={styles.headerBtn}
            hitSlop={8}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <GestureDetector gesture={composed}>
          <Animated.View
            style={[
              styles.imageWrap,
              { width: viewW, height: viewH },
            ]}
          >
            <Animated.View style={[{ width: viewW, height: viewH }, animStyle]}>
              {source ? (
                <Image
                  source={source}
                  style={{ width: viewW, height: viewH }}
                  contentFit="contain"
                />
              ) : (
                <View style={{ width: viewW, height: viewH, backgroundColor: "#111" }} />
              )}
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        <View style={[styles.footer, { paddingBottom: bottomPad }]}>
          <Text style={styles.footerHint}>
            Pinch to zoom · double-tap to toggle · drag to pan
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  imageWrap: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: "center",
  },
  footerHint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },
});
