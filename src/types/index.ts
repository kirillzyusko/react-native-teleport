import type { StyleProp, ViewStyle } from "react-native";

export type PortalProviderProps = {
  children: React.ReactNode;
};
export type PortalHostProps = {
  name: string;
  /**
   * Render above navigation in the current React surface, below native modals.
   * Defaults to false. The host's React/Fabric anchor stays in its original tree;
   * this changes the physical destination, not the React context or modal policy.
   */
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};
export type PortalProps = {
  name?: string;
  hostName?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Integer priority within a host (default 0); higher priorities appear above
   * lower ones. Equal priorities follow committed Portal mount order. Remount a
   * closed Portal to give it a new opening order; rerenders retain its position.
   * Must be between -2147483647 and 2147483647 on every platform.
   */
  stackOrder?: number;
  children?: React.ReactNode;
};
