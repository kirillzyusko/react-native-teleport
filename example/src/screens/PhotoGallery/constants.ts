import { Dimensions } from "react-native";

export const SCREEN_WIDTH = Math.min(Dimensions.get("window").width, 540);
export const COLUMNS = 3;
export const GAP = 3;
export const THUMB_SIZE = (SCREEN_WIDTH - GAP * (COLUMNS - 1)) / COLUMNS;
export const SCALE = SCREEN_WIDTH / THUMB_SIZE;
