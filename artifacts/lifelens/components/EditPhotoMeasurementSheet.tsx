import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Measurement, TrackPhoto } from "@/context/TrackContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  photo: TrackPhoto | null;
  measurement: Measurement;
  resolveSrc: (p: TrackPhoto) => string;
  onClose: () => void;
  onSave: (value: number | null) => Promise<void>;
}

export function EditPhotoMeasurementSheet({
  visible,
  photo,
  measurement,
  resolveSrc,
  onClose,
  onSave,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && photo) {
      setInput(photo.measurementValue != null ? String(photo.measurementValue) : "");
      setError(null);
      setSaving(false);
    }
  }, [visible, photo]);

  async function commit(value: number | null) {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    const trimmed = input.trim().replace(",", ".");
    if (trimmed.length === 0) {
      void commit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setError("Please enter a valid number.");
      return;
    }
    void commit(parsed);
  }

  function handleClear() {
    setInput("");
    void commit(null);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  paddingBottom: insets.bottom + 20,
                },
              ]}
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {measurement.label}
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {photo ? (
                <Image
                  source={{ uri: resolveSrc(photo) }}
                  style={[styles.thumb, { backgroundColor: colors.muted }]}
                  contentFit="cover"
                />
              ) : null}

              <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                <TextInput
                  testID="edit-photo-measurement-input"
                  style={[styles.input, { color: colors.foreground }]}
                  value={input}
                  onChangeText={(t) => {
                    setInput(t);
                    if (error) setError(null);
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  autoFocus
                  maxLength={10}
                />
                {measurement.unit ? (
                  <Text style={[styles.unit, { color: colors.mutedForeground }]}>
                    {measurement.unit}
                  </Text>
                ) : null}
              </View>

              {error ? (
                <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
              ) : null}

              <View style={styles.actions}>
                {photo?.measurementValue != null ? (
                  <TouchableOpacity
                    testID="edit-photo-clear-button"
                    onPress={handleClear}
                    disabled={saving}
                    style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.btnSecondaryText, { color: colors.destructive }]}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  testID="edit-photo-save-button"
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.btnPrimaryText}>
                    {saving ? "Saving…" : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignSelf: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "baseline",
    borderBottomWidth: 1,
    paddingBottom: 6,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    padding: 0,
  },
  unit: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
  },
  error: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  btnPrimary: {},
  btnPrimaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
  },
});
