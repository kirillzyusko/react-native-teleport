import { Dimensions, StyleSheet } from "react-native";

const { width, height } = Dimensions.get("window");

export const SCREEN_DIMENSIONS = {
  width,
  height,
};

export const SAFE_AREA_INSETS = {
  top: 0,
  bottom: 0,
};

export const COLORS = {
  background: "#ffffff",
  backgroundMuted: "#f3f4f6",
  backgroundPressed: "#e5e7eb",
  divider: "rgba(15, 23, 42, 0.08)",
  text: "#111827",
  textMuted: "#6b7280",
  danger: "#dc2626",
};

export const CORNERS = {
  menu: 18,
};

export const SHADOW = StyleSheet.create({
  elevated: {
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 18,
    borderRadius: CORNERS.menu,
  },
});

export const TIMINGS = {
  close: 180,
};
