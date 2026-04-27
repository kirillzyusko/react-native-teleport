import { useCallback, useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StaticScreenProps } from "@react-navigation/native";

import type { Photo } from "./photos";
import { SCREEN_WIDTH } from "./constants";
import { useHeroTransition } from "./hero";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PhotoDetailProps = StaticScreenProps<{ photo: Photo }>;

function PhotoDetail({ route }: PhotoDetailProps) {
  const { photo } = route.params;
  const { targetElementAvailable, visibility, set } = useHeroTransition();
  const progress = useHeroTransition((s) => s.progress);
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

  const onLoad = useCallback(() => {
    if (useHeroTransition.getState().id === photo.id) {
      targetElementAvailable();
    }
  }, [photo.id, targetElementAvailable]);

  const onGoBack = useCallback(() => {
    progress.set(0);
    set({
      id: "",
      position: undefined,
      visibility: { source: 1, target: 0 },
      isAnimationCompleted: false,
      isTargetElementAvailable: false,
    });
    navigation.goBack();
  }, [navigation, set, progress]);

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: photo.fullSize }}
        style={{
          width: SCREEN_WIDTH,
          height: fullHeight,
          marginTop: safeAreaTop,
          opacity: visibility.target,
        }}
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
  container: {
    flex: 1,
    backgroundColor: "#000",
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
