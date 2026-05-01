import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export const COMMON_UNITS = ["cm", "in", "ft", "mm", "m", "lbs", "kg", "oz", "g", "%", "bpm"] as const;

interface Props {
  value: string;
  onChange: (next: string) => void;
  testID?: string;
}

export function UnitPicker({ value, onChange, testID }: Props) {
  const colors = useColors();
  const isPreset = (COMMON_UNITS as readonly string[]).includes(value);
  const [customMode, setCustomMode] = useState<boolean>(
    value.length > 0 && !isPreset,
  );

  useEffect(() => {
    if (value.length > 0 && !isPreset) setCustomMode(true);
  }, [value, isPreset]);

  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.row}>
        {COMMON_UNITS.map((u) => {
          const selected = !customMode && value === u;
          return (
            <Pressable
              key={u}
              testID={`unit-chip-${u}`}
              onPress={() => {
                setCustomMode(false);
                onChange(u);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? "#000" : colors.foreground },
                ]}
              >
                {u}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          testID="unit-chip-custom"
          onPress={() => {
            setCustomMode(true);
            if (isPreset) onChange("");
          }}
          style={[
            styles.chip,
            {
              backgroundColor: customMode ? colors.primary : colors.card,
              borderColor: customMode ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: customMode ? "#000" : colors.foreground },
            ]}
          >
            Custom
          </Text>
        </Pressable>
      </View>
      {customMode ? (
        <TextInput
          testID="unit-custom-input"
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
          placeholder="Custom unit (e.g. reps)"
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChange}
          maxLength={10}
          returnKeyType="done"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
