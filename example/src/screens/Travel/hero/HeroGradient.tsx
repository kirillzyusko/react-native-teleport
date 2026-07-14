import { StyleSheet } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useHeroStore } from "./store";

const colors = ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.89)"];

export default function HeroGradient() {
  const progress = useHeroStore((state) => state.progress);

  const sourceStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));
  const targetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <>
      <Animated.View style={[styles.source, sourceStyle]}>
        <LinearGradient colors={colors} style={styles.fill} />
      </Animated.View>
      <Animated.View style={[styles.target, targetStyle]}>
        <LinearGradient colors={colors} style={styles.fill} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  source: {
    ...StyleSheet.absoluteFillObject,
  },
  target: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "80%",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
