import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import MovieCard from "./components/MovieCard";
import PeekBackdrop from "./components/PeekBackdrop";
import { HORIZONTAL_MARGIN } from "./constants";
import { usePeekTransition } from "./hooks/usePeekTransition";
import { movies } from "./movies";

export default function PeekAndPop() {
  const progress = usePeekTransition((state) => state.progress);

  const animatedProps = useAnimatedProps(
    () => ({
      scrollEnabled: progress.value === 0,
    }),
    [],
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <PeekBackdrop />
      <Animated.ScrollView
        animatedProps={animatedProps}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Tonight</Text>
          <Text style={styles.title}>Movies</Text>
        </View>
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#EFEFF4",
    flex: 1,
  },
  content: {
    paddingBottom: 36,
    paddingHorizontal: HORIZONTAL_MARGIN,
    paddingTop: 10,
  },
  header: {
    paddingBottom: 18,
    paddingTop: 6,
  },
  eyebrow: {
    color: "#D2523C",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0,
  },
});
