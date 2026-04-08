import type { ViewStyle } from "react-native";

export type PortalProviderProps = {
  children: React.ReactNode;
};
export type PortalHostProps = {
  name: string;
  style?: ViewStyle;
  children?: React.ReactNode;
};
export type PortalProps = {
  name?: string;
  hostName?: string;
  style?: ViewStyle;
  /** Controls insertion order when multiple Portals target the same host. Bigger == inserted later */
  order?: number;
  children?: React.ReactNode;
};
