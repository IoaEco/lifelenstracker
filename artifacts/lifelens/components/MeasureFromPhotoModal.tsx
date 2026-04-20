import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { GestureResponderHandlers } from "react-native";
import {
  Modal,
  PanResponder,
  Platform,
  Pressable,
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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  CUSTOM_REFERENCE_ID,
  REFERENCES,
  getReferenceById,
  mmToUnit,
  normalizeLengthUnit,
  type LengthUnit,
} from "@/lib/referenceCatalog";

interface Point {
  x: number;
  y: number;
}

interface Props {
  visible: boolean;
  photoUri: string | null;
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

type EndpointKey = "refA" | "refB" | "subA" | "subB";

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export function MeasureFromPhotoModal({
  visible,
  photoUri,
  measurementLabel,
  measurementUnit,
  initialReferenceId,
  onClose,
  onAccept,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  const imgWidth = Math.min(winW, 600);
  const topSpace = insets.top + 120;
  const bottomSpace = insets.bottom + 220;
  const maxHeight = Math.max(240, winH - topSpace - bottomSpace);
  const imgHeight = Math.min(maxHeight, imgWidth * (4 / 3));

  const lengthUnit: LengthUnit | null = useMemo(
    () => normalizeLengthUnit(measurementUnit),
    [measurementUnit],
  );

  const [referenceId, setReferenceId] = useState<string>(
    initialReferenceId || REFERENCES[0].id,
  );
  const [customMm, setCustomMm] = useState<string>("");

  const [refA, setRefA] = useState<Point>({ x: imgWidth * 0.2, y: imgHeight * 0.25 });
  const [refB, setRefB] = useState<Point>({ x: imgWidth * 0.45, y: imgHeight * 0.25 });
  const [subA, setSubA] = useState<Point>({ x: imgWidth * 0.2, y: imgHeight * 0.65 });
  const [subB, setSubB] = useState<Point>({ x: imgWidth * 0.8, y: imgHeight * 0.65 });

  // Mirror latest point values into refs so PanResponder handlers (created once)
  // always read the current value instead of stale closures.
  const refAVal = useRef(refA);
  const refBVal = useRef(refB);
  const subAVal = useRef(subA);
  const subBVal = useRef(subB);
  refAVal.current = refA;
  refBVal.current = refB;
  subAVal.current = subA;
  subBVal.current = subB;

  const [activeEndpoint, setActiveEndpoint] = useState<EndpointKey | null>(null);

  // Reset endpoint positions when modal opens
  useEffect(() => {
    if (visible) {
      setRefA({ x: imgWidth * 0.2, y: imgHeight * 0.25 });
      setRefB({ x: imgWidth * 0.45, y: imgHeight * 0.25 });
      setSubA({ x: imgWidth * 0.2, y: imgHeight * 0.65 });
      setSubB({ x: imgWidth * 0.8, y: imgHeight * 0.65 });
      setReferenceId(initialReferenceId || REFERENCES[0].id);
      setCustomMm("");
      setActiveEndpoint(null);
      scale.value = 1;
      savedScale.value = 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Pinch-to-zoom via reanimated
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const scaleRef = useRef(1);

  const setScaleRef = (v: number) => {
    scaleRef.current = v;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale));
      scale.value = next;
      runOnJS(setScaleRef)(next);
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

  // Build pan responders once; handlers read current positions from refs to avoid stale closures.
  function buildPan(
    key: EndpointKey,
    getVal: () => Point,
    setVal: (p: Point) => void,
  ) {
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
        const s = scaleRef.current || 1;
        const next = clampPoint({
          x: startRef.x + gesture.dx / s,
          y: startRef.y + gesture.dy / s,
        });
        setVal(next);
      },
      onPanResponderRelease: () => setActiveEndpoint(null),
      onPanResponderTerminate: () => setActiveEndpoint(null),
    });
  }

  const refAPan = useRef(buildPan("refA", () => refAVal.current, setRefA)).current;
  const refBPan = useRef(buildPan("refB", () => refBVal.current, setRefB)).current;
  const subAPan = useRef(buildPan("subA", () => subAVal.current, setSubA)).current;
  const subBPan = useRef(buildPan("subB", () => subBVal.current, setSubB)).current;

  const refDistPx = Math.hypot(refB.x - refA.x, refB.y - refA.y);
  const subDistPx = Math.hypot(subB.x - subA.x, subB.y - subA.y);

  const selectedReference = useMemo(() => {
    if (referenceId === CUSTOM_REFERENCE_ID) {
      const mm = Number(customMm.replace(",", "."));
      return { id: CUSTOM_REFERENCE_ID, label: "Custom", lengthMm: mm };
    }
    const r = getReferenceById(referenceId);
    return r ? { id: r.id, label: r.label, lengthMm: r.lengthMm } : null;
  }, [referenceId, customMm]);

  const canCompute =
    !!selectedReference &&
    Number.isFinite(selectedReference.lengthMm) &&
    selectedReference.lengthMm > 0 &&
    refDistPx > 2 &&
    subDistPx > 2 &&
    lengthUnit !== null;

  const subjectMm = canCompute
    ? (subDistPx / refDistPx) * (selectedReference?.lengthMm ?? 0)
    : null;

  const convertedValue =
    subjectMm != null && lengthUnit ? mmToUnit(subjectMm, lengthUnit) : null;

  function activePoint(): Point | null {
    switch (activeEndpoint) {
      case "refA":
        return refA;
      case "refB":
        return refB;
      case "subA":
        return subA;
      case "subB":
        return subB;
      default:
        return null;
    }
  }

  function handleAccept() {
    if (convertedValue == null || !selectedReference) return;
    onAccept({ value: convertedValue, referenceId: selectedReference.id });
  }

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom + 8;

  const loupePoint = activePoint();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
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
        <View style={styles.imgWrap}>
          <GestureDetector gesture={pinch}>
            <Animated.View
              style={[
                { width: imgWidth, height: imgHeight, overflow: "hidden" },
                imgAnimatedStyle,
              ]}
            >
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  style={{ width: imgWidth, height: imgHeight }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{ width: imgWidth, height: imgHeight, backgroundColor: "#111" }}
                />
              )}

              {/* Measurement lines */}
              <Svg
                pointerEvents="none"
                width={imgWidth}
                height={imgHeight}
                style={StyleSheet.absoluteFill}
              >
                <Line
                  x1={refA.x}
                  y1={refA.y}
                  x2={refB.x}
                  y2={refB.y}
                  stroke="#FFD93D"
                  strokeWidth={2}
                />
                <Line
                  x1={subA.x}
                  y1={subA.y}
                  x2={subB.x}
                  y2={subB.y}
                  stroke="#00D4FF"
                  strokeWidth={2}
                />
              </Svg>

              <Endpoint
                testID="endpoint-refA"
                point={refA}
                color="#FFD93D"
                label="R1"
                panHandlers={refAPan.panHandlers}
                active={activeEndpoint === "refA"}
              />
              <Endpoint
                testID="endpoint-refB"
                point={refB}
                color="#FFD93D"
                label="R2"
                panHandlers={refBPan.panHandlers}
                active={activeEndpoint === "refB"}
              />
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

          {/* Magnifier loupe (screen-space, unscaled) */}
          {loupePoint && photoUri ? (
            <Loupe
              photoUri={photoUri}
              focusX={loupePoint.x}
              focusY={loupePoint.y}
              imgWidth={imgWidth}
              imgHeight={imgHeight}
            />
          ) : null}
        </View>

        {/* Bottom panel */}
        <View
          style={[
            styles.bottomPanel,
            { backgroundColor: colors.background, paddingBottom: bottomPad + 8 },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            REFERENCE OBJECT
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {REFERENCES.map((r) => {
              const selected = referenceId === r.id;
              return (
                <Pressable
                  key={r.id}
                  testID={`reference-chip-${r.id}`}
                  onPress={() => setReferenceId(r.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.primary + "22" : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: selected ? colors.primary : colors.foreground },
                    ]}
                  >
                    {r.label}
                  </Text>
                  <Text
                    style={[styles.chipSub, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {r.lengthMm} mm
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              testID={`reference-chip-${CUSTOM_REFERENCE_ID}`}
              onPress={() => setReferenceId(CUSTOM_REFERENCE_ID)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    referenceId === CUSTOM_REFERENCE_ID
                      ? colors.primary + "22"
                      : colors.card,
                  borderColor:
                    referenceId === CUSTOM_REFERENCE_ID
                      ? colors.primary
                      : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color:
                      referenceId === CUSTOM_REFERENCE_ID
                        ? colors.primary
                        : colors.foreground,
                  },
                ]}
              >
                Custom
              </Text>
              <Text style={[styles.chipSub, { color: colors.mutedForeground }]}>
                mm
              </Text>
            </Pressable>
          </ScrollView>

          {referenceId === CUSTOM_REFERENCE_ID ? (
            <View style={styles.customRow}>
              <TextInput
                testID="custom-mm-input"
                value={customMm}
                onChangeText={setCustomMm}
                placeholder="Enter mm"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                style={[
                  styles.customInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
                maxLength={8}
              />
              <Text style={[styles.customUnit, { color: colors.mutedForeground }]}>
                mm
              </Text>
            </View>
          ) : null}

          <View style={styles.resultRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                RESULT
              </Text>
              <Text
                testID="measure-result-value"
                style={[styles.resultText, { color: colors.foreground }]}
              >
                {convertedValue != null && lengthUnit
                  ? `${formatNumber(convertedValue)} ${measurementUnit}`
                  : lengthUnit == null
                    ? "Unit not length-based"
                    : "Drag endpoints to measure"}
              </Text>
            </View>
            <TouchableOpacity
              testID="measure-accept-button"
              onPress={handleAccept}
              disabled={!canCompute}
              style={[
                styles.acceptBtn,
                {
                  backgroundColor: canCompute ? colors.primary : colors.muted,
                  opacity: canCompute ? 1 : 0.6,
                },
              ]}
            >
              <Text
                style={[
                  styles.acceptText,
                  { color: canCompute ? "#000" : colors.mutedForeground },
                ]}
              >
                Use value
              </Text>
            </TouchableOpacity>
          </View>

          {lengthUnit == null ? (
            <Text style={[styles.warning, { color: colors.destructive }]}>
              Visual measuring needs a length unit (cm, mm, in, m, ft). Your unit is
              &quot;{measurementUnit || "none"}&quot;.
            </Text>
          ) : (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Align the yellow line with the reference object, then the cyan line with what
              you&apos;re measuring. Pinch to zoom.
            </Text>
          )}
        </View>
      </View>
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

function Loupe({
  photoUri,
  focusX,
  focusY,
  imgWidth,
  imgHeight,
}: {
  photoUri: string;
  focusX: number;
  focusY: number;
  imgWidth: number;
  imgHeight: number;
}) {
  // Show the loupe opposite to the finger's vertical half so it's not covered
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
        source={{ uri: photoUri }}
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
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 90,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  chipSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  customUnit: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  resultText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
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
  warning: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});

