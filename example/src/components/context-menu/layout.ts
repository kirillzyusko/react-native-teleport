import { SAFE_AREA_INSETS, SCREEN_DIMENSIONS } from "../../../styles/common";

import type { ViewStyle } from "react-native";
import type {
  AnimationType,
  ContextMenuOffsets,
  CoverType,
  HorizontalMovement,
  Insets,
  Layout,
  Size,
} from "./types";

type AnchorPoint = (dimension: number) => number;

const zero: AnchorPoint = () => 0;
const full: AnchorPoint = (dimension) => dimension;
const half: AnchorPoint = (dimension) => dimension / 2;

const x: Record<CoverType, AnchorPoint> = {
  "top-left": zero,
  "top-center": half,
  "top-right": full,
  "bottom-left": zero,
  "bottom-center": half,
  "bottom-right": full,
};

const y: Record<CoverType, AnchorPoint> = {
  "top-left": zero,
  "top-right": zero,
  "top-center": zero,
  "bottom-left": full,
  "bottom-right": full,
  "bottom-center": full,
};

const horizontal: Record<AnimationType, AnchorPoint> = {
  "top-left": full,
  "top-right": zero,
  "bottom-left": full,
  "bottom-right": zero,
};

const vertical: Record<AnimationType, AnchorPoint> = {
  "top-left": full,
  "top-right": full,
  "bottom-left": zero,
  "bottom-right": zero,
};

export const getAnchorPoint = (
  cover: CoverType,
  animation: AnimationType,
  anchorLayout: Layout,
  popupSize: Size,
): ViewStyle => {
  const width = x[cover](anchorLayout.width);
  const height = y[cover](anchorLayout.height);
  const verticalShift = vertical[animation](popupSize.height);
  const horizontalShift = horizontal[animation](popupSize.width);

  // if it's center based direction, then we need to apply universal shift
  // which is equal to half of the popup width
  const isCentric = cover.includes("center");
  const leftShift = isCentric ? half(popupSize.width) : horizontalShift;

  return {
    position: "absolute",
    top: anchorLayout.y - verticalShift + height,
    left: anchorLayout.x - leftShift + width,
  };
};

/**
 * A helper function which make a movement from the center of the parent to its final destination.
 * For that we need to know a width of view and its paddings/margins. After that knowing view
 * layout and animation direction we can calculate a shift.
 */
export const getHorizontalBias = (
  width: number,
  offsets: ContextMenuOffsets,
  animation: AnimationType,
): number => {
  "worklet";

  const isLeftAnimation = animation.includes("left");

  const margin = offsets.marginLeft || offsets.marginHorizontal || 0;
  const padding = offsets.paddingLeft || offsets.paddingHorizontal || 0;

  return (width / 2 + margin + padding) * (isLeftAnimation ? -1 : 1);
};

type DestinationPointFunction = (
  anchorLayout: Layout,
  popupSize: Size,
) => number;

/**
 * Allows to select only one direction of the view.
 * See https://app.asana.com/0/1201479125182522/1203465316518559 for more details
 * why it's needed and which cases it handles.
 */
const getOneDirectionMovement = (
  movement: number,
  distance: number,
  opposedMovement: number,
) => {
  if (
    // if view should be moved in one direction, but it will move the menu off screen
    // then we need to move into opposed direction
    Math.abs(movement) >= distance
  ) {
    return opposedMovement;
  }

  return undefined;
};
const top: DestinationPointFunction = (anchorLayout, popupSize) => {
  const distanceToBottom =
    SCREEN_DIMENSIONS.height -
    anchorLayout.y -
    anchorLayout.height -
    SAFE_AREA_INSETS.bottom;
  const distanceToTop =
    anchorLayout.y - popupSize.height - SAFE_AREA_INSETS.top;
  const moveFromBottomToTop = Math.min(distanceToBottom, 0);
  const moveFromTopToBottom = -Math.min(distanceToTop, 0);

  return (
    getOneDirectionMovement(
      moveFromBottomToTop,
      distanceToTop,
      moveFromTopToBottom,
    ) ?? moveFromBottomToTop + moveFromTopToBottom
  );
};
const bottom: DestinationPointFunction = (anchorLayout, popupSize) => {
  const distanceToBottom =
    SCREEN_DIMENSIONS.height -
    anchorLayout.y -
    anchorLayout.height -
    popupSize.height -
    SAFE_AREA_INSETS.bottom;
  const distanceToTop = anchorLayout.y - SAFE_AREA_INSETS.top;
  const moveFromBottomToTop = Math.min(distanceToBottom, 0);
  const moveFromTopToBottom = -Math.min(distanceToTop, 0);

  return (
    getOneDirectionMovement(
      moveFromTopToBottom,
      distanceToBottom,
      moveFromBottomToTop,
    ) ?? moveFromBottomToTop + moveFromTopToBottom
  );
};

/**
 * A utility that helps determine how far the anchor (and the context menu) needs to be moved
 * so that the context menu does not go beyond the screen. Calculations are relative to the top
 * of the screen (only vertical movement is supported for now, since according to figma sketches,
 * horizontal movement is not yet planned, but it can be implemented similarly to this approach).
 */
const destination: Record<
  AnimationType,
  (anchorLayout: Layout, popupSize: Size) => number
> = {
  "top-left": top,
  "top-right": top,
  "bottom-right": bottom,
  "bottom-left": bottom,
};

export const getDestinationCoordinates = (
  animation: AnimationType,
  anchorLayout: Layout,
  popupSize: Size,
): HorizontalMovement => {
  const top = destination[animation](anchorLayout, popupSize);

  return { top };
};

// TODO: insets?.top || 0 -- looks ugly
export const getAnchorOverflow = (
  insets: Insets,
  anchorLayout: Layout,
  animation: AnimationType,
) => {
  const top = anchorLayout.y - SAFE_AREA_INSETS.top - (insets?.top || 0); // cut from above
  const bottom =
    SCREEN_DIMENSIONS.height -
    (anchorLayout.y + anchorLayout.height) -
    SAFE_AREA_INSETS.bottom -
    (insets?.bottom || 0); // cut from below

  console.log(9999, top, bottom);

  // view is cut from both directions
  if (top < 0 && bottom < 0) {
    if (animation.includes("bottom")) {
      console.log(8888, {
        top: 0,
        height: anchorLayout.height + bottom + top,
        bottom: -bottom,
      });
      return {
        top: 0,
        height: anchorLayout.height + bottom + top,
        bottom: -bottom,
      };
    }

    if (animation.includes("top")) {
      console.log(7777, {
        top: -top,
        height: anchorLayout.height + top,
        bottom: 0,
      });
      return {
        top: -top,
        height: anchorLayout.height + top,
        bottom: 0,
      };
    }
  }

  const invisiblePartOfAnchor = -Math.min(
    top,
    bottom,
    0, // fully visible
  );
  console.log(
    33333,
    top,
    bottom,
    0, // fully visible
  );
  console.log(2222, {
    top: Math.abs(Math.min(top, 0)),
    height: anchorLayout.height - invisiblePartOfAnchor,
    bottom: Math.abs(Math.min(bottom, 0)),
  });

  return {
    top: Math.abs(Math.min(top, 0)),
    height: anchorLayout.height - invisiblePartOfAnchor,
    bottom: Math.abs(Math.min(bottom, 0)),
  };
};
