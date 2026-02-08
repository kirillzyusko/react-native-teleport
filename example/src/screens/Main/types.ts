import type { ScreenNames } from "../../constants/screenNames";

export type ExampleScreen =
  | ScreenNames.GESTURE_HANDLER_TOUCHABLE
  | ScreenNames.REACT_NATIVE_TOUCHABLE
  | ScreenNames.DYNAMIC_CHILDREN
  | ScreenNames.INSTANT_ROOT
  | ScreenNames.HOOKS
  | ScreenNames.FLEXIBLE_STYLES
  | ScreenNames.PORTAL_BEFORE_HOST
  | ScreenNames.NAVIGATION_LIFECYCLE
  | ScreenNames.INSTAGRAM_FEED
  | ScreenNames.BOTTOM_SHEET
  | ScreenNames.MESSENGER
  | ScreenNames.TRAVEL_EXPLORE
  | ScreenNames.TELEPORTATION_ORDER;

export type Example = {
  testID: string;
  title: string;
  info: ExampleScreen;
  icons: string;
};
