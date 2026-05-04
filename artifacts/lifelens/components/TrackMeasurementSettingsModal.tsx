import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Measurement } from "@/context/TrackContext";
import { useColors } from "@/hooks/useColors";
import { UnitPicker } from "@/components/UnitPicker";

interface Props {
  visible: boolean;
  measurement: Measurement | null;
  onClose: () => void;
  onSave: (next: Measurement | null) => Promise<void>;
}

export function TrackMeasurementSettingsModal({ visible, measurement, onClose, onSave }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setLabel(measurement?.label ?? "");
      setUnit(measurement?.unit ?? "");
      setSaving(false);
    }
  }, [visible, measurement]);

  async function handleSave() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    try {
      await onSave({ label: trimmedLabel, unit: unit.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert("Save failed", "Could not update measurement settings.");
    } finally {
      setSaving(false);
    }
  }

  function handleRemove() {
    if (!measurement) {
      onClose();
      return;
    }
    const confirm = async () => {
      setSaving(true);
      try {
        await onSave(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onClose();
      } finally {
        setSaving(false);
      }
    };
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" && window.confirm(
        "Remove this measurement? Existing values stay on each photo but the chart will hide.",
      );
      if (ok) void confirm();
      return;
    }
    Alert.alert(
      "Remove measurement",
      "Existing values stay on each photo, but the chart will hide. You can re-enable later.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void confirm() },
      ],
    );
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
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                maxHeight: "85%",
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  Track measurement
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                To track height, waist size, hair length, etc., assign each photo a measurement — your own or AI. A label and unit are required to use AI measurement. Example: Label = Height, Unit = in
              </Text>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  LABEL
                </Text>
                <TextInput
                  testID="settings-measurement-label"
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  value={label}
                  onChangeText={setLabel}
                  placeholder="e.g. Weight"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={30}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  onBlur={() => Keyboard.dismiss()}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  UNIT
                </Text>
                <UnitPicker
                  testID="settings-measurement-unit"
                  value={unit}
                  onChange={setUnit}
                />
              </View>
            </ScrollView>

            <View style={[styles.actions, { paddingBottom: insets.bottom + 20 }]}>
              {measurement ? (
                <TouchableOpacity
                  onPress={handleRemove}
                  disabled={saving}
                  style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
                >
                  <Text style={[styles.btnSecondaryText, { color: colors.destructive }]}>
                    Remove
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                testID="settings-measurement-save"
                onPress={handleSave}
                disabled={saving || !label.trim()}
                style={[
                  styles.btn,
                  {
                    backgroundColor: label.trim() ? colors.primary : colors.muted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.btnPrimaryText,
                    { color: label.trim() ? "#000" : colors.mutedForeground },
                  ]}
                >
                  {saving ? "Saving…" : "Save"}
                </Text>
              </TouchableOpacity>
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
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
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
  hint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
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
    backgroundColor: "transparent",
  },
  btnSecondaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  btnPrimaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
