import type { ScreenNames } from "../../constants/screenNames";

export type ExampleScreen =
  | ScreenNames.GESTURE_HANDLER_TOUCHABLE
  | ScreenNames.REACT_NATIVE_TOUCHABLE
  | ScreenNames.DYNAMIC_CHILDREN
  | ScreenNames.INSTANT_ROOT
  | ScreenNames.HOOKS
  | ScreenNames.FLEXIBLE_STYLES
  | ScreenNames.PORTAL_BEFORE_HOST
  | ScreenNames.RECYCLING
  | ScreenNames.NAVIGATION_LIFECYCLE
  | ScreenNames.INSTAGRAM_FEED
  | ScreenNames.BOTTOM_SHEET
  | ScreenNames.MESSENGER_LIST
  | ScreenNames.TRAVEL_EXPLORE
  | ScreenNames.TELEPORTATION_ORDER
  | ScreenNames.RICH_TEXT_EDITOR;

export type Example = {
  testID: string;
  title: string;
  info: ExampleScreen;
  icons: string;
};
