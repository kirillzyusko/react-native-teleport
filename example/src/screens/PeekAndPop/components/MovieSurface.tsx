import { Image, StyleSheet, Text, useWindowDimensions } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CARD_HEIGHT,
  CARD_RADIUS,
  HORIZONTAL_MARGIN,
  PREVIEW_MAX_WIDTH,
  PREVIEW_VERTICAL_MARGIN,
} from "../constants";
import {
  usePeekTransition,
  type TransitionLayout,
} from "../hooks/usePeekTransition";
import type { Movie } from "../movies";

type Props = {
  layout?: TransitionLayout;
  moving: boolean;
  movie: Movie;
};

const AnimatedText = Animated.createAnimatedComponent(Text);
const TITLE_CARD_X = 18;
const TITLE_PREVIEW_X = 22;
const TITLE_DETAILS_X = 24;
const TITLE_CARD_Y = CARD_HEIGHT - 44;

export default function MovieSurface({ layout, moving, movie }: Props) {
  const progress = usePeekTransition((state) => state.progress);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardLayout = layout ?? {
    x: HORIZONTAL_MARGIN,
    y: insets.top,
    width: windowWidth - HORIZONTAL_MARGIN * 2,
    height: CARD_HEIGHT,
  };

  const previewWidth = Math.min(
    windowWidth - HORIZONTAL_MARGIN * 2,
    PREVIEW_MAX_WIDTH,
  );
  const previewImageHeight = Math.round(previewWidth * 0.68);
  const availablePreviewHeight = Math.max(
    420,
    windowHeight - insets.top - insets.bottom - PREVIEW_VERTICAL_MARGIN * 2,
  );
  const previewHeight = Math.min(
    previewImageHeight + 208,
    availablePreviewHeight,
  );
  const previewLeft = (windowWidth - previewWidth) / 2;
  const previewTop = Math.max(
    insets.top + 16,
    (windowHeight - previewHeight) / 2,
  );
  const detailsImageHeight = Math.min(windowHeight * 0.56, 520);

  const frameStyle = useAnimatedStyle(() => {
    if (!moving) {
      return {
        height: CARD_HEIGHT,
      };
    }

    return {
      borderRadius: interpolate(
        progress.value,
        [0, 1, 2],
        [CARD_RADIUS, 24, 0],
      ),
      height: interpolate(
        progress.value,
        [0, 1, 2],
        [cardLayout.height, previewHeight, windowHeight],
      ),
      left: interpolate(
        progress.value,
        [0, 1, 2],
        [cardLayout.x, previewLeft, 0],
      ),
      top: interpolate(
        progress.value,
        [0, 1, 2],
        [cardLayout.y, previewTop, 0],
      ),
      width: interpolate(
        progress.value,
        [0, 1, 2],
        [cardLayout.width, previewWidth, windowWidth],
      ),
    };
  }, [
    cardLayout.height,
    cardLayout.width,
    cardLayout.x,
    cardLayout.y,
    moving,
    previewHeight,
    previewLeft,
    previewTop,
    previewWidth,
    windowHeight,
    windowWidth,
  ]);

  const imageStyle = useAnimatedStyle(
    () => ({
      height: moving
        ? interpolate(
            progress.value,
            [0, 1, 2],
            [CARD_HEIGHT, previewImageHeight, detailsImageHeight],
          )
        : CARD_HEIGHT,
    }),
    [detailsImageHeight, moving, previewImageHeight],
  );

  const shadeStyle = useAnimatedStyle(
    () => ({
      opacity: moving
        ? interpolate(progress.value, [0, 0.7, 1, 2], [0.45, 0.24, 0, 0])
        : 0.45,
    }),
    [moving],
  );

  const titleStyle = useAnimatedStyle(() => {
    const value = progress.value;

    return {
      color: moving
        ? interpolateColor(
            value,
            [0, 0.75, 1, 2],
            ["#FFFFFF", "#FFFFFF", "#111827", "#111827"],
          )
        : "#FFFFFF",
      fontSize: moving
        ? interpolate(value, [0, 0.18, 1, 2], [21, 21, 28, 32])
        : 21,
      transform: moving
        ? [
            {
              translateX: interpolate(
                value,
                [0, 0.18, 1, 2],
                [
                  0,
                  0,
                  TITLE_PREVIEW_X - TITLE_CARD_X,
                  TITLE_DETAILS_X - TITLE_CARD_X,
                ],
              ),
            },
            {
              translateY: interpolate(
                value,
                [0, 0.18, 1, 2],
                [
                  0,
                  0,
                  previewImageHeight + 18 - TITLE_CARD_Y,
                  detailsImageHeight + 28 - TITLE_CARD_Y,
                ],
              ),
            },
          ]
        : [],
    };
  }, [detailsImageHeight, moving, previewImageHeight]);

  const metaStyle = useAnimatedStyle(
    () => ({
      opacity: moving
        ? interpolate(progress.value, [0, 0.55, 1, 2], [0, 0, 1, 1])
        : 0,
      transform: [
        {
          translateX: moving
            ? interpolate(progress.value, [0, 1, 2], [18, 22, 24])
            : 18,
        },
        {
          translateY: moving
            ? interpolate(
                progress.value,
                [0, 1, 2],
                [
                  CARD_HEIGHT + 8,
                  previewImageHeight + 74,
                  detailsImageHeight + 92,
                ],
              )
            : CARD_HEIGHT + 8,
        },
      ],
    }),
    [detailsImageHeight, moving, previewImageHeight],
  );

  const descriptionStyle = useAnimatedStyle(
    () => ({
      opacity: moving
        ? interpolate(progress.value, [0, 0.65, 1, 2], [0, 0, 1, 1])
        : 0,
      transform: [
        {
          translateX: moving
            ? interpolate(progress.value, [0, 1, 2], [18, 22, 24])
            : 18,
        },
        {
          translateY: moving
            ? interpolate(
                progress.value,
                [0, 1, 2],
                [
                  CARD_HEIGHT + 54,
                  previewImageHeight + 126,
                  detailsImageHeight + 148,
                ],
              )
            : CARD_HEIGHT + 54,
        },
      ],
    }),
    [detailsImageHeight, moving, previewImageHeight],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.surface,
        moving ? styles.movingSurface : styles.staticSurface,
        frameStyle,
      ]}
    >
      <Animated.View style={[styles.artwork, imageStyle]}>
        <Image source={movie.poster} resizeMode="cover" style={styles.image} />
        <Animated.View style={[styles.shade, shadeStyle]} />
      </Animated.View>
      <AnimatedText
        numberOfLines={moving ? 2 : 1}
        style={[styles.title, titleStyle]}
      >
        {movie.title}
      </AnimatedText>
      <Animated.View style={[styles.meta, metaStyle]}>
        <Text style={styles.rating}>{movie.rating}</Text>
        <Text style={styles.metaText}>{movie.year}</Text>
        <Text style={styles.dot}>/</Text>
        <Text style={styles.metaText}>{movie.duration}</Text>
        <Text style={styles.dot}>/</Text>
        <Text style={styles.metaText}>{movie.genre}</Text>
      </Animated.View>
      <AnimatedText
        numberOfLines={moving ? 4 : 1}
        style={[styles.description, descriptionStyle]}
      >
        {movie.description}
      </AnimatedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: "#FCFBF7",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  staticSurface: {
    borderRadius: CARD_RADIUS,
    width: "100%",
  },
  movingSurface: {
    elevation: 18,
    position: "absolute",
    zIndex: 4,
  },
  artwork: {
    backgroundColor: "#1B202C",
    overflow: "hidden",
    width: "100%",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  title: {
    fontWeight: "800",
    left: TITLE_CARD_X,
    letterSpacing: 0,
    lineHeight: 36,
    position: "absolute",
    right: 48,
    top: TITLE_CARD_Y,
  },
  meta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    left: 0,
    position: "absolute",
    right: 48,
    top: 0,
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
  dot: {
    color: "#9AA3AF",
    fontSize: 13,
    fontWeight: "700",
  },
  description: {
    color: "#46505E",
    fontSize: 16,
    fontWeight: "500",
    left: 0,
    lineHeight: 23,
    position: "absolute",
    right: 48,
    top: 0,
  },
});
