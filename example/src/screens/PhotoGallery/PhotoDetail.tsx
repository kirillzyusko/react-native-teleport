import { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StaticScreenProps } from "@react-navigation/native";

import type { Photo } from "./photos";
import { SCALE, SCREEN_WIDTH } from "./constants";
import { useHeroTransition } from "./hero";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PhotoDetailProps = StaticScreenProps<{ photo: Photo }>;

function PhotoDetail({ route }: PhotoDetailProps) {
  const { photo } = route.params;
  const { targetElementAvailable, visibility } = useHeroTransition();
  const progress = useHeroTransition((s) => s.progress);
  const direction = useHeroTransition((s) => s.direction);
  const position = useHeroTransition((s) => s.position);
  const goBack = useHeroTransition((s) => s.goBack);
  const navigation = useNavigation();
  const { top: safeAreaTop } = useSafeAreaInsets();

  const fullHeight = SCREEN_WIDTH * (photo.height / photo.width);

  const isTransitionDone = visibility.target === 1;
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    buttonOpacity.value = withTiming(isTransitionDone ? 1 : 0, {
      duration: 200,
    });
  }, [isTransitionDone, buttonOpacity]);

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));
  const backdrop = useAnimatedStyle(
    () => ({
      opacity: direction === "neutral" ? 1 : progress.value,
    }),
    [direction],
  );

  const heroImage = useAnimatedStyle(() => {
    if (direction !== "backward" || !position) {
      return {
        width: SCREEN_WIDTH,
        height: fullHeight,
        transform: [],
      };
    }
    return {
      width: SCREEN_WIDTH,
      height: interpolate(progress.value, [0, 1], [SCREEN_WIDTH, fullHeight]),
      transform: [
        { translateX: interpolate(progress.value, [0, 1], [position.x, 0]) },
        {
          translateY: interpolate(
            progress.value,
            [0, 1],
            [position.y - safeAreaTop, 0],
          ),
        },
        { scale: interpolate(progress.value, [0, 1], [1 / SCALE, 1]) },
      ],
    };
  }, [direction, position, safeAreaTop, fullHeight]);

  const onLoad = useCallback(() => {
    if (useHeroTransition.getState().id === photo.id) {
      targetElementAvailable();
    }
  }, [photo.id, targetElementAvailable]);

  const onGoBack = useCallback(() => {
    goBack(navigation.goBack);
  }, [navigation, goBack]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.backdrop, backdrop]} />
      <Animated.Image
        source={{ uri: photo.fullSize }}
        style={[
          styles.heroImage,
          { marginTop: safeAreaTop, opacity: visibility.target },
          heroImage,
        ]}
        resizeMode="cover"
        onLoad={onLoad}
      />
      <AnimatedPressable
        style={[styles.backButton, { top: safeAreaTop + 10 }, buttonStyle]}
        onPress={onGoBack}
        disabled={!isTransitionDone}
      >
        <Text style={styles.backText}>Close</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
  },
  heroImage: {
    transformOrigin: "0% 0%",
  },
  backButton: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PhotoDetail;
