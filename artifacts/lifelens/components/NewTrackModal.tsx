import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TRACK_ICONS, type IoniconsName } from "@/constants/icons";
import { useColors } from "@/hooks/useColors";
import { useTrack } from "@/context/TrackContext";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function NewTrackModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addTrack } = useTrack();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<IoniconsName>("body-outline");
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState("");

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
        {/* Header */}
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
          {/* Title Input */}
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

          {/* Description Input */}
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

          {/* Icon Picker */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              ICON
            </Text>
            <View style={styles.iconGrid}>
              {TRACK_ICONS.map((icon) => {
                const isSelected = selectedIcon === icon.name;
                return (
                  <Pressable
                    key={icon.name}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedIcon(icon.name);
                    }}
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
                      name={icon.name}
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
                    >
                      {icon.label}
                    </Text>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    padding: 4,
  },
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
  field: {
    gap: 8,
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
  },
  iconLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
  },
});
