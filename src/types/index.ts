import type { StyleProp, ViewStyle } from "react-native";
import type {
  PortalHostProps as SharedPortalHostProps,
  PortalProps as SharedPortalProps,
} from "./shared";

export type { PortalProviderProps } from "./shared";
export type PortalHostProps = SharedPortalHostProps<StyleProp<ViewStyle>>;
export type PortalProps = SharedPortalProps<StyleProp<ViewStyle>>;
