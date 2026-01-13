import { Dimensions, Platform } from "react-native";

export const SCREEN_HEIGHT = Dimensions.get("screen").height;
export const SCREEN_WIDTH = Math.min(Dimensions.get("screen").width, 540);
export const ASPECT_RATIO = 3 / 4;
export const VIDEO_HEIGHT = SCREEN_WIDTH / ASPECT_RATIO;
export const CARD_HEIGHT = VIDEO_HEIGHT + 100;

/**
 * iOS can draw header on top of video because we use specific `presentation="transparentModal"`
 * for other platforms draw on top of everything manually.
 */
export const FLOATING_ELEMENTS_DESTINATION = Platform.select({
  ios: undefined,
  default: "root",
});
