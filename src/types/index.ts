import type { StyleProp, ViewStyle } from "react-native";

export type PortalProviderProps = {
  children: React.ReactNode;
};
export type PortalHostProps = {
  name: string;
  /** Render above navigation in the current React surface, below native modals. */
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};
export type PortalProps = {
  name?: string;
  hostName?: string;
  style?: StyleProp<ViewStyle>;
  /** Priority within a host (default 0). Equal priorities follow Portal mount order. */
  stackOrder?: number;
  children?: React.ReactNode;
};
