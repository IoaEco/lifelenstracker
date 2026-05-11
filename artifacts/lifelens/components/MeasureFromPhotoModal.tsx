import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import type { GestureResponderHandlers } from "react-native";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import type { PhotoSource } from "@/context/TrackContext";
import * as FileSystem from 'expo-file-system'; // Optional, but useful

interface Point {
  x: number;
  y: number;
}

interface Props {
  visible: boolean;
  photoSource: PhotoSource | null;
  measurementLabel: string;
  measurementUnit: string;
  initialReferenceId?: string | null;
  onClose: () => void;
  onAccept: (params: { value: number; referenceId: string }) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const HANDLE_SIZE = 28;
const LOUPE_SIZE = 110;
const LOUPE_ZOOM = 2.4;

type EndpointKey = "subA" | "subB";

type AiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "result"; estimate: number }
  | { status: "error"; message: string };

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function getPhotoUri(source: PhotoSource | null): string | null {
  if (!source) return null;
  if (typeof source === "string") return source;
  if (typeof source === "object" && source !== null && "uri" in source) {
    return (source as { uri: string }).uri;
  }
  return null;
}

export function MeasureFromPhotoModal({
  visible,
  photoSource,
  measurementLabel,
  measurementUnit,
  onClose,
  onAccept,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  const imgWidth = Math.min(winW, 600);
  const topSpace = insets.top + 50;
  const bottomSpace = insets.bottom + 20;
  const maxHeight = Math.max(240, winH - topSpace - bottomSpace);
  const imgHeight = Math.min(maxHeight, imgWidth * (4 / 3));

  const [subA, setSubA] = useState<Point>({ x: imgWidth * 0.2, y: imgHeight * 0.5 });
  const [subB, setSubB] = useState<Point>({ x: imgWidth * 0.8, y: imgHeight * 0.5 });

  const subAVal = useRef(subA);
  const subBVal = useRef(subB);
  subAVal.current = subA;
  subBVal.current = subB;

  const [activeEndpoint, setActiveEndpoint] = useState<EndpointKey | null>(null);
  const [aiState, setAiState] = useState<AiState>({ status: "idle" });
  const [adjustedValue, setAdjustedValue] = useState<string>("");

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSubA({ x: imgWidth * 0.2, y: imgHeight * 0.5 });
      setSubB({ x: imgWidth * 0.8, y: imgHeight * 0.5 });
      setActiveEndpoint(null);
      setAiState({ status: "idle" });
      setAdjustedValue("");
      scale.value = 1;
      savedScale.value = 1;
    }
  }, [visible, imgWidth, imgHeight]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const imgAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function clampPoint(p: Point): Point {
    return {
      x: Math.max(0, Math.min(imgWidth, p.x)),
      y: Math.max(0, Math.min(imgHeight, p.y)),
    };
  }

  // Pan responders (unchanged but cleaned)
  function buildPan(key: EndpointKey, getVal: () => Point, setVal: (p: Point) => void) {
    const startRef = { x: 0, y: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const cur = getVal();
        startRef.x = cur.x;
        startRef.y = cur.y;
        setActiveEndpoint(key);
      },
      onPanResponderMove: (_evt, gesture) => {
        const s = scale.value || 1;
        setVal(clampPoint({
          x: startRef.x + gesture.dx / s,
          y: startRef.y + gesture.dy / s,
        }));
      },
      onPanResponderRelease: () => setActiveEndpoint(null),
      onPanResponderTerminate: () => setActiveEndpoint(null),
    });
  }

  function buildLinePan(
    getA: () => Point,
    getB: () => Point,
    setA: (p: Point) => void,
    setB: (p: Point) => void,
  ) {
    const startA = { x: 0, y: 0 };
    const startB = { x: 0, y: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const a = getA();
        const b = getB();
        startA.x = a.x; startA.y = a.y;
        startB.x = b.x; startB.y = b.y;
      },
      onPanResponderMove: (_evt, gesture) => {
        const s = scale.value || 1;
        setA(clampPoint({ x: startA.x + gesture.dx / s, y: startA.y + gesture.dy / s }));
        setB(clampPoint({ x: startB.x + gesture.dx / s, y: startB.y + gesture.dy / s }));
      },
    });
  }

  const subAPan = useRef(buildPan("subA", () => subAVal.current, setSubA)).current;
  const subBPan = useRef(buildPan("subB", () => subBVal.current, setSubB)).current;
  const subLinePan = useRef(buildLinePan(
    () => subAVal.current,
    () => subBVal.current,
    setSubA,
    setSubB,
  )).current;

  // ==================== IMPROVED AI ESTIMATION ====================
  async function handleEstimate() {
    if (!photoSource) return;

    try {
      setAiState({ status: "loading" });

      const uri = getPhotoUri(photoSource);
      if (!uri) throw new Error("No photo available");

      // Resize image first (very important for speed and cost)
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const manipulated = await manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.85, format: SaveFormat.JPEG, base64: true }
      );

      if (!manipulated.base64) throw new Error("Failed to process image");

      const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("Anthropic API key is missing");

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",        // Best current model
          max_tokens: 100,
          temperature: 0.0,
          system: `You are an expert at estimating real-world lengths from photos.
Respond with ONLY a single number (with at most one decimal place). 
No units, no explanation, no extra text whatsoever.`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: manipulated.base64,
                  },
                },
                {
                  type: "text",
                  text: `Estimate the ${measurementLabel} in ${measurementUnit}.`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const text = (data?.content?.[0]?.text ?? "").trim();

      const matches = text.match(/[\d.]+/g);
      const num = matches ? parseFloat(matches[matches.length - 1]) : NaN;

      if (!Number.isFinite(num) || num <= 0) {
        setAiState({
          status: "error",
          message: "AI could not detect a valid measurement. Try a clearer photo with a reference object.",
        });
        return;
      }

      setAiState({ status: "result", estimate: num });
      setAdjustedValue(formatNumber(num));

    } catch (err: any) {
      console.error('AI Estimation Error:', err);
      setAiState({
        status: "error",
        message: err.message || "Failed to get AI estimate. Please try again.",
      });
    }
  }

  function handleAccept() {
    const num = parseFloat(adjustedValue.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return;
    onAccept({ value: num, referenceId: "" });
  }

  const canAccept = (() => {
    const num = parseFloat(adjustedValue.replace(",", "."));
    return Number.isFinite(num) && num > 0;
  })();

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom + 8;

  const loupePoint: Point | null =
    activeEndpoint === "subA" ? subA : activeEndpoint === "subB" ? subB : null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.container, { backgroundColor: "#000" }]}>

          {/* Header */}
          <View style={[styles.header, { paddingTop: topPad }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Measure {measurementLabel}</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Image Area */}
          <View style={styles.imgWrap} onTouchEnd={Keyboard.dismiss}>
            <GestureDetector gesture={pinch}>
              <Animated.View style={[{ width: imgWidth, height: imgHeight, overflow: "hidden" }, imgAnimatedStyle]}>
                {photoSource ? (
                  <Image
                    source={photoSource}
                    style={{ width: imgWidth, height: imgHeight }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ width: imgWidth, height: imgHeight, backgroundColor: "#111" }} />
                )}

                <Svg pointerEvents="none" width={imgWidth} height={imgHeight} style={StyleSheet.absoluteFill}>
                  <Line
                    x1={subA.x} y1={subA.y}
                    x2={subB.x} y2={subB.y}
                    stroke="#00D4FF" strokeWidth={2}
                  />
                </Svg>

                <LineDragArea a={subA} b={subB} panHandlers={subLinePan.panHandlers} />
                <Endpoint point={subA} color="#00D4FF" label="S1" panHandlers={subAPan.panHandlers} active={activeEndpoint === "subA"} />
                <Endpoint point={subB} color="#00D4FF" label="S2" panHandlers={subBPan.panHandlers} active={activeEndpoint === "subB"} />
              </Animated.View>
            </GestureDetector>

            {/* Tip Banner */}
            <View style={styles.tipBanner}>
              <Ionicons name="bulb-outline" size={14} color="#FFD93D" />
              <Text style={styles.tipText}>
                Tip: Include a familiar object (coin, bottle, hand, etc.) for better AI accuracy.
              </Text>
            </View>

            {loupePoint && photoSource && (
              <Loupe
                photoSource={photoSource}
                focusX={loupePoint.x}
                focusY={loupePoint.y}
                imgWidth={imgWidth}
                imgHeight={imgHeight}
              />
            )}
          </View>

          {/* Bottom Panel */}
          <ScrollView
            style={styles.bottomPanel}
            contentContainerStyle={[styles.bottomPanelContent, { paddingBottom: bottomPad + 8 }]}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              onPress={handleEstimate}
              disabled={!photoSource || aiState.status === "loading"}
              style={[styles.aiBtn, { backgroundColor: colors.primary, opacity: !photoSource || aiState.status === "loading" ? 0.6 : 1 }]}
            >
              {aiState.status === "loading" ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={16} color="#000" />
                  <Text style={styles.aiBtnText}>Estimate with AI</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.instructionText}>Place S1 at the start · S2 at the end</Text>

            {aiState.status === "result" && (
              <View style={styles.resultBlock}>
                <Text style={[styles.estimateText, { color: colors.foreground }]}>
                  AI estimate: <Text style={{ color: colors.primary }}>{formatNumber(aiState.estimate)} {measurementUnit}</Text>
                </Text>
                <Text style={[styles.estimateNote, { color: colors.mutedForeground }]}>
                  Adjust below if needed
                </Text>

                <View style={styles.adjustRow}>
                  <TextInput
                    value={adjustedValue}
                    onChangeText={setAdjustedValue}
                    keyboardType="decimal-pad"
                    style={[styles.adjustInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                    maxLength={12}
                  />
                  <Text style={[styles.adjustUnit, { color: colors.mutedForeground }]}>{measurementUnit}</Text>
                  <TouchableOpacity
                    onPress={handleAccept}
                    disabled={!canAccept}
                    style={[styles.acceptBtn, { backgroundColor: canAccept ? colors.primary : colors.muted }]}
                  >
                    <Text style={[styles.acceptText, { color: canAccept ? "#000" : colors.mutedForeground }]}>
                      Use this value
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {aiState.status === "error" && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {aiState.message}
              </Text>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ====================== Helper Components ====================== */

function Endpoint({ point, color, label, panHandlers, active }: {
  point: Point;
  color: string;
  label: string;
  panHandlers: GestureResponderHandlers;
  active: boolean;
}) {
  return (
    <View
      {...panHandlers}
      style={{
        position: "absolute",
        left: point.x - HANDLE_SIZE / 2,
        top: point.y - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        borderRadius: HANDLE_SIZE / 2,
        borderWidth: 2,
        borderColor: color,
        backgroundColor: active ? color + "66" : "rgba(0,0,0,0.25)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 9, fontFamily: "Inter_600SemiBold" }}>
        {label}
      </Text>
    </View>
  );
}

function LineDragArea({ a, b, panHandlers }: { a: Point; b: Point; panHandlers: GestureResponderHandlers }) {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const hitHeight = 28;

  return (
    <View
      {...panHandlers}
      style={{
        position: "absolute",
        left: cx - length / 2,
        top: cy - hitHeight / 2,
        width: length,
        height: hitHeight,
        transform: [{ rotate: `${angle}deg` }],
        backgroundColor: "transparent",
      }}
    />
  );
}

function Loupe({ photoSource, focusX, focusY, imgWidth, imgHeight }: {
  photoSource: PhotoSource;
  focusX: number;
  focusY: number;
  imgWidth: number;
  imgHeight: number;
}) {
  const showTop = focusY > imgHeight / 2;
  const loupeX = imgWidth / 2 - LOUPE_SIZE / 2;
  const loupeY = showTop ? 12 : imgHeight - LOUPE_SIZE - 12;

  const translateX = LOUPE_SIZE / 2 - focusX * LOUPE_ZOOM;
  const translateY = LOUPE_SIZE / 2 - focusY * LOUPE_ZOOM;

  return (
    <View pointerEvents="none" style={[styles.loupeContainer, { top: loupeY, left: loupeX }]}>
      <Image
        source={photoSource}
        style={{
          width: imgWidth * LOUPE_ZOOM,
          height: imgHeight * LOUPE_ZOOM,
          transform: [{ translateX }, { translateY }],
        }}
        contentFit="cover"
      />
      <View style={styles.loupeCrosshairV} />
      <View style={styles.loupeCrosshairH} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 12 },
  headerBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  imgWrap: { alignItems: "center", justifyContent: "center", flex: 1, alignSelf: "stretch" },

  tipBanner: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    zIndex: 10,
  },
  tipText: { color: "#fff", fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },

  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 420,
    backgroundColor: "rgba(0,0,0,0.82)",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bottomPanelContent: { gap: 8, flexGrow: 1 },

  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  aiBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#000" },

  instructionText: { color: "#ffffff", fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center", marginTop: 4 },

  resultBlock: { gap: 6 },
  estimateText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  estimateNote: { fontSize: 11, fontFamily: "Inter_400Regular" },

  adjustRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  adjustInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  adjustUnit: { fontSize: 14, fontFamily: "Inter_500Medium" },
  acceptBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22 },
  acceptText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  errorText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  loupeContainer: {
    position: "absolute",
    width: LOUPE_SIZE,
    height: LOUPE_SIZE,
    borderRadius: LOUPE_SIZE / 2,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#000",
  },
  loupeCrosshairV: {
    position: "absolute",
    left: LOUPE_SIZE / 2 - 1,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  loupeCrosshairH: {
    position: "absolute",
    top: LOUPE_SIZE / 2 - 1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
});