import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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

import { NewCategoryModal } from "@/components/NewCategoryModal";
import type { IoniconsName } from "@/constants/icons";
import { useColors } from "@/hooks/useColors";
import { useCategories } from "@/context/CategoriesContext";
import { useTrack } from "@/context/TrackContext";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function NewTrackModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addTrack } = useTrack();
  const { categories, deleteCategory } = useCategories();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<IoniconsName>("body-outline");
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setSelectedIcon("body-outline");
    setTitleError("");
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    if (!title.trim()) {
      setTitleError("Please enter a track name");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    try {
      const newTrack = await addTrack({
        title: title.trim(),
        description: description.trim(),
        iconName: selectedIcon,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onClose();
      router.push(`/track/${newTrack.id}`);
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteCustomCategory(id: string, label: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" && window.confirm(`Delete "${label}" category?`);
      if (ok) deleteCategory(id);
      return;
    }
    Alert.alert(
      "Delete category",
      `Remove "${label}" from your categories? Existing tracks keep their icon.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteCategory(id),
        },
      ]
    );
  }

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

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
            New Track
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !title.trim()}
            style={[
              styles.saveButton,
              {
                backgroundColor: title.trim() ? colors.primary : colors.muted,
              },
            ]}
          >
            <Text
              style={[
                styles.saveText,
                { color: title.trim() ? "#000" : colors.mutedForeground },
              ]}
            >
              {saving ? "Saving..." : "Create"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: bottomPad + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              TRACK NAME
            </Text>
            <TextInput
              testID="track-title-input"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: titleError ? colors.destructive : colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="e.g. Weight loss journey"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                if (t.trim()) setTitleError("");
              }}
              maxLength={50}
              returnKeyType="done"
              autoFocus
            />
            {titleError ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {titleError}
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              DESCRIPTION (OPTIONAL)
            </Text>
            <TextInput
              style={[
                styles.inputMulti,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="What are you tracking?"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              maxLength={200}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />
          </View>

          <View style={styles.field}>
            <View style={styles.categoryHeader}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                CATEGORY
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Long-press a custom one to remove
              </Text>
            </View>
            <View style={styles.iconGrid}>
              {categories.map((cat) => {
                const isSelected = selectedIcon === cat.name;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedIcon(cat.name);
                    }}
                    onLongPress={
                      cat.builtIn
                        ? undefined
                        : () => handleDeleteCustomCategory(cat.id, cat.label)
                    }
                    delayLongPress={350}
                    style={[
                      styles.iconOption,
                      {
                        backgroundColor: isSelected
                          ? colors.primary + "20"
                          : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={cat.name}
                      size={24}
                      color={isSelected ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.iconLabel,
                        {
                          color: isSelected ? colors.primary : colors.mutedForeground,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.label}
                    </Text>
                    {!cat.builtIn && (
                      <View
                        style={[
                          styles.customDot,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              })}

              <Pressable
                testID="add-category-tile"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCategoryModal(true);
                }}
                style={[
                  styles.iconOption,
                  styles.addCategoryTile,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Ionicons name="add" size={24} color={colors.primary} />
                <Text style={[styles.iconLabel, { color: colors.primary }]}>
                  New
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <NewCategoryModal
          visible={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          onCreated={(cat) => {
            setSelectedIcon(cat.name);
          }}
        />
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
  },
  field: { gap: 8 },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
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
  inputMulti: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    minHeight: 90,
    textAlignVertical: "top",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  iconOption: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    position: "relative",
  },
  iconLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
  },
  customDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  addCategoryTile: {
    borderStyle: "dashed",
  },
});
