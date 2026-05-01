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

async function photoToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
  const topSpace = insets.top + 120;
  const bottomSpace = insets.bottom + 50;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

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

  function buildPan(key: EndpointKey, getVal: () => Point, setVal: (p: Point) => void) {
    const startRef = { x: 0, y: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
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
      onPanResponderTerminationRequest: () => false,
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
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
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

  async function handleEstimate() {
    console.log('Button tapped');
    console.log('Button disabled:', !photoSource || aiState.status === "loading");
    try {
      const uri = getPhotoUri(photoSource);
      if (!uri) return;
      setAiState({ status: "loading" });
      const base64 = await photoToBase64(uri);
      console.log('API Key present:', !!(process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY), 'Length:', process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY?.length ?? 0);
      const response = await fetch("http://10.0.0.165:3001/api/ai-estimate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 64,
          system: `You are a measurement tool. Respond with ONLY a single number. No words, no units, no explanation. Just digits and optionally a decimal point. Example response: 42.5`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: base64,
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
      if (!response.ok) throw new Error(`API error ${response.status}`);
      const data = await response.json();
      const text: string = (data?.content?.[0]?.text ?? "").trim();
      console.log('AI raw response:', JSON.stringify(data?.content));
      if (text.toLowerCase() === "null" || text === "") {
        setAiState({ status: "error", message: "AI couldn't estimate from this photo." });
        return;
      }
      const matches = text.match(/[\d.]+/g);
      const num = matches ? parseFloat(matches[matches.length - 1]) : NaN;
      if (!Number.isFinite(num)) {
        setAiState({ status: "error", message: "AI returned an unexpected response." });
        return;
      }
      setAiState({ status: "result", estimate: num });
      setAdjustedValue(formatNumber(num));
    } catch (err) {
      console.error('Estimation error:', err);
      setAiState({
        status: "error",
        message: err instanceof Error ? `AI Error: ${err.message}` : `AI Error: ${String(err)}`,
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          testID="measure-from-photo-modal"
          style={[styles.container, { backgroundColor: "#000" }]}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: topPad }]}>
            <TouchableOpacity
              testID="measure-cancel-button"
              onPress={onClose}
              style={styles.headerBtn}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Measure {measurementLabel}</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Image + endpoints */}
          <View style={styles.imgWrap} onTouchEnd={Keyboard.dismiss}>
              <GestureDetector gesture={pinch}>
                <Animated.View
                  style={[
                    { width: imgWidth, height: imgHeight, overflow: "hidden" },
                    imgAnimatedStyle,
                  ]}
                >
                  {photoSource ? (
                    <Image
                      source={photoSource}
                      style={{ width: imgWidth, height: imgHeight }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{ width: imgWidth, height: imgHeight, backgroundColor: "#111" }}
                    />
                  )}

                  <Svg
                    pointerEvents="none"
                    width={imgWidth}
                    height={imgHeight}
                    style={StyleSheet.absoluteFill}
                  >
                    <Line
                      x1={subA.x}
                      y1={subA.y}
                      x2={subB.x}
                      y2={subB.y}
                      stroke="#00D4FF"
                      strokeWidth={2}
                    />
                  </Svg>

                  <LineDragArea a={subA} b={subB} panHandlers={subLinePan.panHandlers} />
                  <Endpoint
                    testID="endpoint-subA"
                    point={subA}
                    color="#00D4FF"
                    label="S1"
                    panHandlers={subAPan.panHandlers}
                    active={activeEndpoint === "subA"}
                  />
                  <Endpoint
                    testID="endpoint-subB"
                    point={subB}
                    color="#00D4FF"
                    label="S2"
                    panHandlers={subBPan.panHandlers}
                    active={activeEndpoint === "subB"}
                  />
                </Animated.View>
              </GestureDetector>

              {loupePoint && photoSource ? (
                <Loupe
                  photoSource={photoSource}
                  focusX={loupePoint.x}
                  focusY={loupePoint.y}
                  imgWidth={imgWidth}
                  imgHeight={imgHeight}
                />
              ) : null}
          </View>

          {/* Bottom panel */}
          <ScrollView
            style={styles.bottomPanel}
            contentContainerStyle={[styles.bottomPanelContent, { paddingBottom: bottomPad + 8 }]}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              testID="estimate-ai-button"
              onPress={handleEstimate}
              disabled={!photoSource || aiState.status === "loading"}
              style={[
                styles.aiBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: !photoSource || aiState.status === "loading" ? 0.6 : 1,
                },
              ]}
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

            {aiState.status === "result" && (
              <View style={styles.resultBlock}>
                <Text style={[styles.estimateText, { color: colors.foreground }]}>
                  AI estimate:{" "}
                  <Text style={{ color: colors.primary }}>
                    {formatNumber(aiState.estimate)} {measurementUnit}
                  </Text>
                  {" "}— does this look right?
                </Text>
                <Text style={[styles.estimateNote, { color: colors.mutedForeground }]}>
                  AI estimates may vary. Adjust if needed.
                </Text>
                <View style={styles.adjustRow}>
                  <TextInput
                    testID="adjusted-value-input"
                    value={adjustedValue}
                    onChangeText={setAdjustedValue}
                    keyboardType="decimal-pad"
                    style={[
                      styles.adjustInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                    maxLength={12}
                  />
                  <Text style={[styles.adjustUnit, { color: colors.mutedForeground }]}>
                    {measurementUnit}
                  </Text>
                  <TouchableOpacity
                    testID="measure-accept-button"
                    onPress={handleAccept}
                    disabled={!canAccept}
                    style={[
                      styles.acceptBtn,
                      {
                        backgroundColor: canAccept ? colors.primary : colors.muted,
                        opacity: canAccept ? 1 : 0.6,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.acceptText,
                        { color: canAccept ? "#000" : colors.mutedForeground },
                      ]}
                    >
                      Use value
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

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Drag the blue line across what you want to measure, then tap Estimate with AI.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Endpoint({
  point,
  color,
  label,
  panHandlers,
  active,
  testID,
}: {
  point: Point;
  color: string;
  label: string;
  panHandlers: GestureResponderHandlers;
  active: boolean;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
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

function LineDragArea({
  a,
  b,
  panHandlers,
}: {
  a: Point;
  b: Point;
  panHandlers: GestureResponderHandlers;
}) {
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

function Loupe({
  photoSource,
  focusX,
  focusY,
  imgWidth,
  imgHeight,
}: {
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
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: loupeX,
        top: loupeY,
        width: LOUPE_SIZE,
        height: LOUPE_SIZE,
        borderRadius: LOUPE_SIZE / 2,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "#fff",
        backgroundColor: "#000",
      }}
    >
      <Image
        source={photoSource}
        style={{
          width: imgWidth * LOUPE_ZOOM,
          height: imgHeight * LOUPE_ZOOM,
          transform: [{ translateX }, { translateY }],
        }}
        contentFit="cover"
      />
      <View
        style={{
          position: "absolute",
          left: LOUPE_SIZE / 2 - 1,
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: "rgba(255,255,255,0.5)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: LOUPE_SIZE / 2 - 1,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: "rgba(255,255,255,0.5)",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerBtn: { padding: 4 },
  headerTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  imgWrap: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 280,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  bottomPanelContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  aiBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
  },
  resultBlock: {
    gap: 6,
  },
  estimateText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  estimateNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  adjustInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  adjustUnit: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  acceptBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
  },
  acceptText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
