import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useTheme, type ThemeMode } from "@/context/ThemeContext";
import type { IoniconsName } from "@/constants/icons";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const OPTIONS: Array<{ value: ThemeMode; label: string; description: string; icon: IoniconsName }> = [
  {
    value: "system",
    label: "System",
    description: "Match your device settings",
    icon: "phone-portrait-outline",
  },
  {
    value: "light",
    label: "Light",
    description: "Bright and clean",
    icon: "sunny-outline",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Easy on the eyes",
    icon: "moon-outline",
  },
];

export function ThemePickerModal({ visible, onClose }: Props) {
  const colors = useColors();
  const { mode, setMode } = useTheme();

  async function handleSelect(value: ThemeMode) {
    Haptics.selectionAsync();
    await setMode(value);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>Appearance</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.options}>
            {OPTIONS.map((opt) => {
              const selected = mode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  testID={`theme-option-${opt.value}`}
                  onPress={() => handleSelect(opt.value)}
                  activeOpacity={0.7}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? colors.primary + "18" : "transparent",
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: selected
                          ? colors.primary + "26"
                          : colors.muted,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={22}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: colors.foreground }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
                      {opt.description}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    padding: 4,
  },
  options: {
    padding: 12,
    gap: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  optionDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
