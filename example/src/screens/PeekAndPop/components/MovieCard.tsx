import { useCallback, useRef, type ComponentRef } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Portal } from "react-native-teleport";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenNames } from "../../../constants/screenNames";
import type { ExamplesStackNavigation } from "../../../navigation/ExamplesStack";
import { CARD_HEIGHT } from "../constants";
import { usePeekTransition } from "../hooks/usePeekTransition";
import type { Movie } from "../movies";
import MovieSurface from "./MovieSurface";

type Props = {
  movie: Movie;
};

export default function MovieCard({ movie }: Props) {
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const didLongPressRef = useRef(false);
  const isPressingRef = useRef(false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ExamplesStackNavigation>();
  const selected = usePeekTransition((state) => state.movieId === movie.id);
  const destination = usePeekTransition((state) =>
    state.movieId === movie.id ? state.destination : undefined,
  );
  const layout = usePeekTransition((state) =>
    state.movieId === movie.id ? state.layout : undefined,
  );
  const peek = usePeekTransition((state) => state.peek);
  const cancelPeek = usePeekTransition((state) => state.cancelPeek);

  const openDetails = useCallback(() => {
    didLongPressRef.current = false;
    navigation.navigate(ScreenNames.PEEK_AND_POP_DETAILS, {
      movieId: movie.id,
    });
  }, [movie.id, navigation]);

  const onLongPress = useCallback(() => {
    didLongPressRef.current = true;

    requestAnimationFrame(() => {
      cardRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
        if (!Number.isFinite(width) || width === 0) {
          didLongPressRef.current = false;
          cancelPeek();
          return;
        }

        peek(movie.id, {
          x: pageX,
          y: Platform.OS === "android" ? pageY + insets.top : pageY,
          width,
          height,
        });

        if (!isPressingRef.current) {
          openDetails();
        }
      });
    });
  }, [cancelPeek, insets.top, movie.id, openDetails, peek]);

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
    <View ref={cardRef} collapsable={false} style={styles.slot}>
      <Pressable
        delayLongPress={240}
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.pressable}
      >
        <Portal
          hostName={selected ? destination : undefined}
          name={`peek-pop-${movie.id}`}
        >
          <MovieSurface layout={layout} moving={selected} movie={movie} />
        </Portal>
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
});
