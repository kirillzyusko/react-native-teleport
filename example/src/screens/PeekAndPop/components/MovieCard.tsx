import { useCallback, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Portal } from "react-native-teleport";

import { ScreenNames } from "../../../constants/screenNames";
import type { ExamplesStackNavigation } from "../../../navigation/ExamplesStack";
import useMeasure from "../../../hooks/useMeasure";
import { CARD_HEIGHT } from "../constants";
import { usePeekTransition } from "../hooks/usePeekTransition";
import type { Movie } from "../movies";
import MovieSurface from "./MovieSurface";

type Props = {
  movie: Movie;
};

export default function MovieCard({ movie }: Props) {
  const cardRef = useRef<View>(null);
  const didLongPressRef = useRef(false);
  const isPressingRef = useRef(false);
  const navigation = useNavigation<ExamplesStackNavigation>();
  const measure = useMeasure(cardRef);
  const selected = usePeekTransition((state) => state.movieId === movie.id);
  const destination = usePeekTransition((state) =>
    state.movieId === movie.id ? state.destination : undefined,
  );
  const phase = usePeekTransition((state) =>
    state.movieId === movie.id ? state.phase : "idle",
  );
  const layout = usePeekTransition((state) =>
    state.movieId === movie.id ? state.layout : undefined,
  );
  const peek = usePeekTransition((state) => state.peek);
  const cancelPeek = usePeekTransition((state) => state.cancelPeek);
  const shouldRenderPortal = selected && phase !== "restoring";

  const openDetails = useCallback(() => {
    didLongPressRef.current = false;
    navigation.navigate(ScreenNames.PEEK_AND_POP_DETAILS, {
      movieId: movie.id,
    });
  }, [movie.id, navigation]);

  const onLongPress = useCallback(() => {
    didLongPressRef.current = true;

    requestAnimationFrame(() => {
      measure((x, y, width, height) => {
        if (!Number.isFinite(width) || width === 0) {
          didLongPressRef.current = false;
          cancelPeek();
          return;
        }

        peek(movie.id, {
          x,
          y,
          width,
          height,
        });

        if (!isPressingRef.current) {
          openDetails();
        }
      });
    });
  }, [cancelPeek, measure, movie.id, openDetails, peek]);

  const onPressIn = useCallback(() => {
    isPressingRef.current = true;
  }, []);

  const onPressOut = useCallback(() => {
    isPressingRef.current = false;

    if (!didLongPressRef.current) {
      return;
    }

    if (usePeekTransition.getState().movieId === movie.id) {
      openDetails();
    }
  }, [movie.id, openDetails]);

  return (
    <View
      // @ts-expect-error React Native host refs expose measureInWindow.
      ref={cardRef}
      collapsable={false}
      style={styles.slot}
    >
      <Pressable
        delayLongPress={240}
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.pressable}
      >
        {!shouldRenderPortal && <MovieSurface moving={false} movie={movie} />}
        {shouldRenderPortal && (
          <Portal
            hostName={destination}
            name={`peek-pop-${movie.id}`}
            style={styles.portal}
          >
            <MovieSurface layout={layout} moving movie={movie} />
          </Portal>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: CARD_HEIGHT,
    marginBottom: 14,
  },
  pressable: {
    height: CARD_HEIGHT,
  },
  portal: {
    elevation: 20,
    zIndex: 20,
  },
});
