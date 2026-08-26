import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mirror } from "react-native-teleport";

import { getPhotoHeight, getPortalName } from "./constants";
import { isOverlayPhase, useMirrorTransition } from "./transition";

function MirrorTransition() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { top: safeAreaTop } = useSafeAreaInsets();
  const phase = useMirrorTransition((state) => state.phase);
  const photo = useMirrorTransition((state) => state.photo);
  const position = useMirrorTransition((state) => state.position);
  const mirrorSource = useMirrorTransition((state) => state.mirrorSource);
  const progress = useMirrorTransition((state) => state.progress);
  const positionX = position?.x ?? 0;
  const positionY = position?.y ?? 0;
  const positionWidth = position?.width ?? 0;
  const photoHeight = getPhotoHeight(
    screenWidth,
    photo?.width ?? screenWidth,
    photo?.height ?? screenWidth,
  );
  const destinationTop = Math.max(
    safeAreaTop,
    (screenHeight - photoHeight) / 2,
  );

  const frameStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.get(), [0, 1], [positionWidth, screenWidth]),
    height: interpolate(progress.get(), [0, 1], [positionWidth, photoHeight]),
    transform: [
      {
        translateX: interpolate(progress.get(), [0, 1], [positionX, 0]),
      },
      {
        translateY: interpolate(
          progress.get(),
          [0, 1],
          [positionY, destinationTop],
        ),
      },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => {
    const frameWidth = interpolate(
      progress.get(),
      [0, 1],
      [positionWidth, screenWidth],
    );
    const frameHeight = interpolate(
      progress.get(),
      [0, 1],
      [positionWidth, photoHeight],
    );
    const coverScale = Math.max(
      frameWidth / screenWidth,
      frameHeight / photoHeight,
    );

    return {
      transform: [
        { translateX: (frameWidth - screenWidth * coverScale) / 2 },
        { translateY: (frameHeight - photoHeight * coverScale) / 2 },
        { scale: coverScale },
      ],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
  }));

  if (!photo || !position || !isOverlayPhase(phase)) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <Animated.View
        style={[styles.frame, frameStyle]}
        testID="mirror-gallery-animated-mirror"
      >
        <Animated.View
          style={[
            styles.content,
            { width: screenWidth, height: photoHeight },
            contentStyle,
          ]}
        >
          {phase !== "preparing-open" ? (
            <Mirror
              name={getPortalName(photo.id, mirrorSource)}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050505",
  },
  frame: {
    left: 0,
    overflow: "hidden",
    position: "absolute",
    top: 0,
  },
  content: {
    left: 0,
    position: "absolute",
    top: 0,
    transformOrigin: "0% 0%",
  },
});

export default MirrorTransition;
