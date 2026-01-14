import type { ViewStyle } from "react-native";

export type PortalProviderProps = {
  children: React.ReactNode;
};
export type PortalHostProps = {
  name: string;
  style?: ViewStyle;
  children?: React.ReactNode;
  pointerEvents?: React.CSSProperties["pointerEvents"] | "box-none";
};
export type PortalProps = {
  name?: string;
  hostName?: string;
  style?: ViewStyle;
  children: React.ReactNode;
};
