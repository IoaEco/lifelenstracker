import { useContext } from "react";
import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { ThemeContext } from "@/context/ThemeContext";

/**
 * Returns the design tokens for the active color scheme.
 *
 * Reads the user's theme preference from ThemeContext when available.
 * Falls back to the device's system color scheme when called outside the
 * provider (e.g. inside an ErrorBoundary fallback rendered before the
 * provider mounts), so the error UI never crashes due to missing context.
 */
export function useColors() {
  const ctx = useContext(ThemeContext);
  const systemScheme = useColorScheme();
  const scheme = ctx
    ? ctx.scheme
    : systemScheme === "dark"
      ? "dark"
      : "light";
  const palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
