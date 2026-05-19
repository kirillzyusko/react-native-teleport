import { StyleSheet } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

import { usePeekTransition } from "../hooks/usePeekTransition";

export default function PeekBackdrop() {
  const movieId = usePeekTransition((state) => state.movieId);
  const progress = usePeekTransition((state) => state.progress);

  const style = useAnimatedStyle(
    () => ({
      opacity: interpolate(progress.value, [0, 1, 2], [0, 1, 0]),
    }),
    [],
  );

  if (!movieId) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.backdrop, style]} />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 10, 22, 0.54)",
    elevation: 1,
    zIndex: 1,
  },
});
