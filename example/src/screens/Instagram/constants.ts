import { Dimensions } from "react-native";

export const SCREEN_WIDTH = Math.min(Dimensions.get("screen").width, 540);
export const ASPECT_RATION = 3 / 4;
export const VIDEO_HEIGHT = SCREEN_WIDTH / ASPECT_RATION;
export const CARD_HEIGHT = VIDEO_HEIGHT + 100;
