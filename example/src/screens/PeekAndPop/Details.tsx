import { useCallback, useEffect, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import { PortalHost } from "react-native-teleport";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

import { ScreenNames } from "../../constants/screenNames";
import type { ExamplesStackParamList } from "../../navigation/ExamplesStack";
import { DETAILS_DESTINATION } from "./constants";
import { usePeekTransition } from "./hooks/usePeekTransition";
import { movies, type Movie } from "./movies";

type Props = NativeStackScreenProps<
  ExamplesStackParamList,
  ScreenNames.PEEK_AND_POP_DETAILS
>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PeekAndPopDetails({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const movie =
    movies.find((item) => item.id === route.params.movieId) ?? movies[0];
  const activeMovieId = usePeekTransition((state) => state.movieId);
  const phase = usePeekTransition((state) => state.phase);
  const progress = usePeekTransition((state) => state.progress);
  const popToDetails = usePeekTransition((state) => state.popToDetails);
  const closeDetails = usePeekTransition((state) => state.closeDetails);
  const isClosingRef = useRef(false);
  const shouldRenderHost = activeMovieId === movie.id || isClosingRef.current;

  useEffect(() => {
    if (activeMovieId === movie.id && phase === "peek") {
      popToDetails();
    }
  }, [activeMovieId, movie.id, phase, popToDetails]);

  const close = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }

    if (usePeekTransition.getState().movieId !== movie.id) {
      navigation.goBack();
      return;
    }

    isClosingRef.current = true;
    closeDetails(() => navigation.goBack());
  }, [closeDetails, movie.id, navigation]);

  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (
        isClosingRef.current ||
        usePeekTransition.getState().movieId !== movie.id
      ) {
        return;
      }

      event.preventDefault();
      isClosingRef.current = true;
      closeDetails(() => navigation.dispatch(event.data.action));
    });
  }, [closeDetails, movie.id, navigation]);

  const backButtonStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(progress.value, [1.72, 2], [0, 1], "clamp"),
    }),
    [],
  );

  return (
    <View style={styles.screen}>
      {shouldRenderHost ? (
        <PortalHost name={DETAILS_DESTINATION} style={styles.host} />
      ) : (
        <StaticMovieDetails movie={movie} />
      )}
      <AnimatedPressable
        hitSlop={12}
        onPress={close}
        style={[styles.backButton, backButtonStyle, { top: insets.top + 12 }]}
      >
        <FontAwesome6
          color="#111827"
          iconStyle="solid"
          name="chevron-left"
          size={18}
        />
      </AnimatedPressable>
    </View>
  );
}

function StaticMovieDetails({ movie }: { movie: Movie }) {
  return (
    <View style={styles.staticDetails}>
      <Image source={movie.poster} resizeMode="cover" style={styles.poster} />
      <View style={styles.staticContent}>
        <Text style={styles.title}>{movie.title}</Text>
        <View style={styles.meta}>
          <Text style={styles.rating}>{movie.rating}</Text>
          <Text style={styles.metaText}>{movie.year}</Text>
          <Text style={styles.metaText}>{movie.duration}</Text>
          <Text style={styles.metaText}>{movie.genre}</Text>
        </View>
        <Text style={styles.description}>{movie.description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "transparent",
    flex: 1,
  },
  host: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: 21,
    height: 42,
    justifyContent: "center",
    left: 16,
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    width: 42,
    zIndex: 8,
  },
  staticDetails: {
    backgroundColor: "#FCFBF7",
    flex: 1,
  },
  poster: {
    height: "56%",
    width: "100%",
  },
  staticContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  title: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 18,
  },
  meta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  rating: {
    backgroundColor: "#EAB308",
    borderRadius: 8,
    color: "#141414",
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: {
    color: "#46505E",
    fontSize: 14,
    fontWeight: "700",
  },
  description: {
    color: "#46505E",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 23,
  },
});
