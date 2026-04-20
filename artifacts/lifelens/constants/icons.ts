import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

export type IoniconsName = ComponentProps<typeof Ionicons>["name"];

export const TRACK_ICONS: Array<{ name: IoniconsName; label: string }> = [
  { name: "body-outline", label: "Body" },
  { name: "barbell-outline", label: "Fitness" },
  { name: "flower-outline", label: "Plants" },
  { name: "home-outline", label: "Home" },
  { name: "hammer-outline", label: "Build" },
  { name: "heart-outline", label: "Health" },
  { name: "leaf-outline", label: "Nature" },
  { name: "bicycle-outline", label: "Sport" },
  { name: "restaurant-outline", label: "Diet" },
  { name: "medkit-outline", label: "Medical" },
  { name: "camera-outline", label: "Photo" },
  { name: "book-outline", label: "Study" },
  { name: "musical-notes-outline", label: "Music" },
  { name: "walk-outline", label: "Walk" },
  { name: "analytics-outline", label: "Metrics" },
  { name: "brush-outline", label: "Art" },
];
