import type { ViewStyle } from "react-native";

/**
 * ```
 * (top-left)-------------(top-right)
 * |                                |
 * |                                |
 * |                                |
 * (bottom-left)-------(bottom-right)
 * ```
 */
type FourCorners = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type AdditionalAnchorPointsType = "top-center" | "bottom-center";

export type AnimationType = FourCorners;
export type CoverType = AdditionalAnchorPointsType | FourCorners;

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Layout = Point & Size;

export type HorizontalMovement = {
  top: number;
};

export type Destination = {
  overflow: {
    /**
     * hidden part of anchor from top
     */
    top: number;
    /**
     * visible part of anchor
     */
    height: number;
    /**
     * hidden part of anchor from bottom
     */
    bottom: number;
  };
  anchor: Layout;
} & HorizontalMovement;

export type Insets = {
  top?: number;
  bottom?: number;
};
export type InsetsMode = keyof Insets;

// subset of ViewStyle, but horizontal paddings must be numbers to apply
// shift by horizontal axis correctly as well as specified with
export type ContextMenuOffsets = {
  paddingLeft?: number;
  marginLeft?: number;
  paddingHorizontal?: number;
  marginHorizontal?: number;
};

export type ContextMenuStyle = ContextMenuOffsets & ViewStyle;
