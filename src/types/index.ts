import type { StyleProp, ViewStyle } from "react-native";

export type PortalProviderProps = {
  children: React.ReactNode;
};
export type PortalHostProps = {
  name: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};
export type PortalProps = {
  name?: string;
  hostName?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};
