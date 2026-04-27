import { Dimensions } from "react-native";

export const SCREEN_WIDTH = Math.min(Dimensions.get("window").width, 540);
export const COLUMNS = 3;
export const THUMB_SIZE = SCREEN_WIDTH / COLUMNS;
export const SCALE = SCREEN_WIDTH / THUMB_SIZE;
export const SPRING_CONFIG = {
  mass: 1.2,
  damping: 1000,
  stiffness: 500,
  overshootClamping: false,
};
