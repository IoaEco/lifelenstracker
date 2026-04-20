import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
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

import { ICON_PICKER_OPTIONS, type IoniconsName } from "@/constants/icons";
import { useColors } from "@/hooks/useColors";
import { useCategories } from "@/context/CategoriesContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated?: (category: { id: string; name: IoniconsName; label: string }) => void;
}

export function NewCategoryModal({ visible, onClose, onCreated }: Props) {
  const colors = useColors();
  const { addCategory } = useCategories();
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState<IoniconsName>(ICON_PICKER_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setLabel("");
    setIcon(ICON_PICKER_OPTIONS[0]);
    setSaving(false);
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Please enter a category name");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    try {
      const created = await addCategory({ label: trimmed, name: icon });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onClose();
      onCreated?.(created);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            New Category
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !label.trim()}
            style={[
              styles.saveButton,
              {
                backgroundColor: label.trim() ? colors.primary : colors.muted,
              },
            ]}
          >
            <Text
              style={[
                styles.saveText,
                { color: label.trim() ? "#000" : colors.mutedForeground },
              ]}
            >
              {saving ? "Saving..." : "Add"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              CATEGORY NAME
            </Text>
            <TextInput
              testID="category-name-input"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: error ? colors.destructive : colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="e.g. Travel, Garden, Project X"
              placeholderTextColor={colors.mutedForeground}
              value={label}
              onChangeText={(t) => {
                setLabel(t);
                if (t.trim()) setError("");
              }}
              maxLength={20}
              autoFocus
              returnKeyType="done"
            />
            {error ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <View style={styles.previewRow}>
              <View
                style={[
                  styles.previewIconLg,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Ionicons name={icon} size={28} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  PREVIEW
                </Text>
                <Text style={[styles.previewLabel, { color: colors.foreground }]}>
                  {label.trim() || "Your category"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              CHOOSE AN ICON
            </Text>
            <View style={styles.iconGrid}>
              {ICON_PICKER_OPTIONS.map((iconName) => {
                const isSelected = icon === iconName;
                return (
                  <Pressable
                    key={iconName}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setIcon(iconName);
                    }}
                    style={[
                      styles.iconCell,
                      {
                        backgroundColor: isSelected
                          ? colors.primary + "20"
                          : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={iconName}
                      size={22}
                      color={isSelected ? colors.primary : colors.foreground}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { padding: 4 },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  body: {
    padding: 20,
    gap: 24,
    paddingBottom: 60,
  },
  field: { gap: 10 },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  previewIconLg: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  previewLabel: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  iconCell: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
