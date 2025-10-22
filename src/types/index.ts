import type { ViewStyle } from "react-native";

export type PortalProviderProps = {
  children: React.ReactNode;
};
export type PortalHostProps = {
  name: string;
  children?: React.ReactNode;
};
export type PortalProps = {
  name?: string;
  hostName?: string;
  style?: ViewStyle;
  children: React.ReactNode;
};
