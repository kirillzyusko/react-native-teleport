import React, { useCallback, useRef } from "react";
import { StyleSheet, TouchableWithoutFeedback, View } from "react-native";
import type { HostInstance } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Portal } from "react-native-teleport";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Photo } from "./photos";
import { GAP, SCALE, SCREEN_WIDTH, THUMB_SIZE } from "./constants";
import { useHeroTransition } from "./hero";

type Props = {
  photo: Photo;
  onOpen: (photo: Photo) => void;
};

function PhotoPreview({ photo, onOpen }: Props) {
  const ref = useRef<HostInstance>(null);
  const isAnimating = useHeroTransition((s) => s.id === photo.id);
  const position = useHeroTransition((s) =>
    s.id === photo.id ? s.position : undefined,
  );
  const progress = useHeroTransition((s) => s.progress);
  const set = useHeroTransition((s) => s.set);
  const source = useHeroTransition((s) =>
    s.id === photo.id ? s.visibility.source : 1,
  );
  const transitionCompleted = useHeroTransition((s) => s.transitionCompleted);
  const { top: safeAreaTop } = useSafeAreaInsets();

  // Height the full image takes at thumbnail scale
  const fullImageHeight = SCREEN_WIDTH * (photo.height / photo.width);
  const diff = fullImageHeight / SCALE - THUMB_SIZE;

  const animatedHeight = useAnimatedStyle(
    () => ({
      height: isAnimating
        ? interpolate(progress.value, [0, 1], [THUMB_SIZE, THUMB_SIZE + diff])
        : THUMB_SIZE,
    }),
    [isAnimating, diff],
  );

  const transform = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: interpolate(
            progress.value,
            [0, 1],
            [0, -(position?.x ?? 0)],
          ),
        },
        {
          translateY: interpolate(
            progress.value,
            [0, 1],
            [0, safeAreaTop - (position?.y ?? 0)],
          ),
        },
        {
          scale: interpolate(progress.value, [0, 1], [1, SCALE]),
        },
      ],
    };
  }, [position, safeAreaTop]);

  const onPress = useCallback(() => {
    if (useHeroTransition.getState().id !== "") return;

    ref.current?.measureInWindow((x: number, y: number) => {
      set({
        position: { x, y },
        visibility: { source: 1, target: 0 },
        isAnimationCompleted: false,
        isTargetElementAvailable: false,
        id: photo.id,
      });

      requestAnimationFrame(() => {
        progress.set(
          withSpring(
            1,
            {
              mass: 1.2,
              damping: 1000,
              stiffness: 500,
              overshootClamping: false,
            },
            () => {
              runOnJS(transitionCompleted)();
            },
          ),
        );
        onOpen(photo);
      });
    });
  }, [photo, set, progress, transitionCompleted, onOpen]);

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View
        ref={ref}
        style={{
          height: THUMB_SIZE + GAP,
        }}
      >
        <Portal hostName={position && isAnimating ? "root" : undefined}>
          <Animated.View
            style={
              isAnimating
                ? [
                    styles.animating,
                    {
                      top: position?.y,
                      left: position?.x,
                      opacity: source,
                    },
                    transform,
                  ]
                : undefined
            }
          >
            <Animated.Image
              style={[
                { width: THUMB_SIZE },
                isAnimating ? animatedHeight : styles.thumb,
              ]}
              source={{ uri: photo.thumbnail }}
              resizeMode="cover"
            />
          </Animated.View>
        </Portal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  thumb: {
    height: THUMB_SIZE,
    marginBottom: GAP,
  },
  animating: {
    transformOrigin: "0% 0%",
  },
});

export default React.memo(PhotoPreview);
