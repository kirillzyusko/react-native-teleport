import React, { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { PortalHost } from "react-native-teleport";

import { TeleportContext, defaultDestination } from "./context";

import type { Destination } from "../types";

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

const TeleportProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const destination = useSharedValue(defaultDestination);
  const progress = useSharedValue(0);
  const setDestination = useCallback(
    (target: Partial<Destination>, callback?: () => void) => {
      "worklet";

      destination.value = {
        ...destination.value,
        ...target,
      };

      if (callback) {
        runOnJS(callback)();
      }
    },
    [],
  );
  const resetDestination = useCallback(() => {
    destination.value = defaultDestination;
  }, [destination]);
  const context = useMemo(
    () => ({ progress, destination, setDestination, resetDestination }),
    [destination, progress, resetDestination, setDestination],
  );

  const translateY = useDerivedValue(() => {
    return Math.min(
      destination.value.anchor.height -
        destination.value.overflow.height -
        destination.value.overflow.bottom,
      destination.value.anchor.height -
        destination.value.overflow.height -
        destination.value.overflow.top,
    );
  }, []);

  const movement = useAnimatedStyle(() => {
    const fullHeightInProgressScale = Math.min(
      (destination.value.overflow.top + destination.value.overflow.bottom) /
        Math.abs(destination.value.top || 1),
      1,
    );
    const fullHeight =
      destination.value.overflow.bottom !== 0 &&
      destination.value.overflow.top !== 0
        ? destination.value.overflow.height + destination.value.overflow.bottom
        : destination.value.overflow.height +
          destination.value.overflow.top +
          destination.value.overflow.bottom;
    const height = interpolate(
      progress.value,
      [0, fullHeightInProgressScale],
      [destination.value.overflow.height, fullHeight],
      Extrapolate.CLAMP,
    );
    const top = interpolate(
      progress.value,
      [0, 1],
      [
        destination.value.anchor.y + destination.value.overflow.top,
        destination.value.anchor.y,
      ],
      Extrapolate.CLAMP,
    );

    return {
      overflow: height !== 0 ? ("hidden" as const) : undefined,
      top,
      left: destination.value.anchor.x,
      width: destination.value.anchor.width,
      height,
      transform: [
        {
          translateY: interpolate(
            progress.value,
            [0, 1],
            [0, destination.value.top],
          ),
        },
        {
          translateY: translateY.value,
        },
      ],
    };
  }, []);

  const relative = useAnimatedStyle(() => {
    return {
      position: "absolute" as const,
      top: interpolate(
        progress.value,
        [0, 1],
        [-destination.value.overflow.top, 0],
        Extrapolate.CLAMP,
      ),
      transform: [
        {
          translateY: -translateY.value,
        },
      ],
    };
  }, []);

  return (
    <TeleportContext.Provider value={context}>
      {children}
      <View pointerEvents="box-none" style={styles.overlay}>
        <Animated.View style={movement}>
          <Animated.View style={relative}>
            <PortalHost name="context-menu-teleport" />
          </Animated.View>
        </Animated.View>
      </View>
    </TeleportContext.Provider>
  );
};

export default TeleportProvider;
