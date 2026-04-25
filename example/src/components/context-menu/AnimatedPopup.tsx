import { forwardRef, useCallback, useImperativeHandle, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useTeleport } from "./teleport/context";
import {
  getAnchorPoint,
  getDestinationCoordinates,
  getHorizontalBias,
} from "./layout";
import { SPRING_CONFIGURATION_MENU } from "./state";
import { COLORS, CORNERS, SHADOW, TIMINGS } from "./theme";
import BlurredBackground from "./BlurredBackground";

import type { AnimationCallback } from "react-native-reanimated";
import type {
  AnimationType,
  ContextMenuStyle,
  CoverType,
  Layout,
  Point,
  Size,
} from "./types";
import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";

type AnimatedPopupProps = {
  style: ContextMenuStyle;
  cover: CoverType;
  blurred?: boolean;
  horizontalMovementRelativeToAnchor: boolean;
  animation: AnimationType;
  pivot: Point;
  layout: Layout;
  children: ReactNode;
  onClosed: AnimationCallback;
};

export type AnimatedPopupRef = {
  close: () => void;
};

const INITIAL_SCALE = 0.1;
const HALF_HEIGHT = 0.5 - INITIAL_SCALE / 2;
const FAR_FAR_AWAY = -10000;

const styles = StyleSheet.create({
  options: {
    borderRadius: CORNERS.menu,
    backgroundColor: COLORS.background,
    minWidth: 160,
  },
  shadow: SHADOW.elevated,
});

const getPivotPoint = (pivot: Point, size: Size) => {
  "worklet";

  const translateX = (0.5 - pivot.x) * size.width;
  const translateY = (0.5 - pivot.y) * size.height;

  return {
    start: [{ translateX }, { translateY }],
    end: [{ translateX: -translateX }, { translateY: -translateY }],
  };
};

const AnimatedPopup = forwardRef<AnimatedPopupRef, AnimatedPopupProps>(
  (props, ref) => {
    const {
      pivot,
      style,
      cover,
      animation,
      layout: anchorLayout,
      onClosed,
      blurred,
      horizontalMovementRelativeToAnchor,
    } = props;
    const { progress, setDestination, resetDestination } = useTeleport();
    const layout = useSharedValue({
      isMeasured: false,
      width: 0,
      height: 0,
      style: {},
      destination: { top: 0 },
    });

    const onLayout = useCallback(
      ({ nativeEvent: { layout: layoutEvent } }: LayoutChangeEvent) => {
        if (layout.value.isMeasured) {
          return;
        }

        const destination = getDestinationCoordinates(animation, anchorLayout, {
          height: layoutEvent.height,
          width: layoutEvent.width,
        });

        layout.value = {
          width: layoutEvent.width,
          height: layoutEvent.height,
          isMeasured: true,
          style: getAnchorPoint(cover, animation, anchorLayout, {
            height: layoutEvent.height,
            width: layoutEvent.width,
          }),
          destination: destination,
        };

        setDestination(destination);
        progress.value = withSpring(1, SPRING_CONFIGURATION_MENU);
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        close: () => {
          progress.value = withTiming(
            0,
            { duration: TIMINGS.close },
            (finished) => {
              runOnJS(onClosed)(finished);
              runOnJS(resetDestination)();
            },
          );
        },
      }),
      [onClosed],
    );

    const { paddingLeft, paddingHorizontal, marginLeft, marginHorizontal } =
      style;

    const transform = useAnimatedStyle(() => {
      if (!layout.value.isMeasured) {
        return {
          left: FAR_FAR_AWAY,
        };
      }
      const isToTopDirection = animation.includes("top");
      const anchor = getPivotPoint(pivot, {
        width: layout.value.width,
        height: layout.value.height,
      });

      return {
        overflow: "hidden",
        opacity: Easing.inOut(Easing.sin)(progress.value),
        height: interpolate(
          progress.value,
          [0, 1],
          [INITIAL_SCALE * layout.value.height, layout.value.height],
        ),
        left: horizontalMovementRelativeToAnchor
          ? interpolate(
              progress.value,
              [0, 1],
              [
                getHorizontalBias(
                  anchorLayout.width,
                  {
                    paddingLeft,
                    paddingHorizontal,
                    marginLeft,
                    marginHorizontal,
                  },
                  animation,
                ),
                0,
              ],
            )
          : 0,
        transform: [
          {
            translateX: -180,
          },
          {
            translateY: -33,
          },
          {
            translateY: interpolate(
              progress.value,
              [0, 1],
              [HALF_HEIGHT * layout.value.height, 0],
            ),
          },
          // `anchor.start` is needed to specify pivot point for simple transformation (without height)
          // feel free to try to remove `height` animation and corresponding `translateY` (above and below `scale`)
          // animation will not change, since it's a first level of the movement compensation.
          // if you remove `anchor.start` and `anchor.end` - animation will start from the center of the view.
          // `translateY` before and after `scale` are compensating height animation (simultaneously with scale)
          ...anchor.start,
          {
            scale: interpolate(progress.value, [0, 1], [INITIAL_SCALE, 1]),
          },
          ...anchor.end,
          // depends on animation direction we apply different compensation to make pivot point static
          {
            translateY: interpolate(
              progress.value,
              [0, 1],
              [
                (isToTopDirection ? 1 : -1) * HALF_HEIGHT * layout.value.height,
                0,
              ],
            ),
          },
          // additional movement of context menu (will work only if content goes beyond screen borders)
          {
            translateY: interpolate(
              progress.value,
              [0, 1],
              [0, layout.value.destination.top],
            ),
          },
        ],
      };
    }, []);
    const parent = useAnimatedStyle(() => ({
      ...layout.value.style,
      alignSelf: "flex-start",
      position: "absolute",
    }));
    const animated = useMemo(() => [styles.options, transform], []);
    const popup = useMemo(() => [parent, style], []);

    const { children } = props;

    return (
      <>
        {blurred && <BlurredBackground />}
        <Reanimated.View onLayout={onLayout} style={popup}>
          <View style={styles.shadow}>
            <Reanimated.View style={animated}>{children}</Reanimated.View>
          </View>
        </Reanimated.View>
      </>
    );
  },
);

export default AnimatedPopup;
