import { useCallback, useEffect } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  usePreventRemove,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StaticScreenProps } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Portal } from "react-native-teleport";

import type { ExamplesStackParamList } from "../../navigation/ExamplesStack";
import { getPhotoHeight, getPortalName } from "./constants";
import MirrorTransition from "./MirrorTransition";
import PHOTOS from "./photos";
import { isDestinationVisible, useMirrorTransition } from "./transition";

type Props = StaticScreenProps<{ photoId: string }>;
type Navigation = NativeStackNavigationProp<ExamplesStackParamList>;

function MirrorPhotoDetail({ route }: Props) {
  const navigation = useNavigation<Navigation>();
  const safeArea = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const phase = useMirrorTransition((state) => state.phase);
  const selectedPhoto = useMirrorTransition((state) => state.photo);
  const position = useMirrorTransition((state) => state.position);
  const mirrorSource = useMirrorTransition((state) => state.mirrorSource);
  const mountMirror = useMirrorTransition((state) => state.mountMirror);
  const startOpening = useMirrorTransition((state) => state.startOpening);
  const completeOpeningHandoff = useMirrorTransition(
    (state) => state.completeOpeningHandoff,
  );
  const prepareClose = useMirrorTransition((state) => state.prepareClose);
  const startClosing = useMirrorTransition((state) => state.startClosing);
  const cancelOpening = useMirrorTransition((state) => state.cancelOpening);
  const markFullResLoaded = useMirrorTransition(
    (state) => state.markFullResLoaded,
  );

  const photo =
    selectedPhoto?.id === route.params.photoId
      ? selectedPhoto
      : PHOTOS.find((item) => item.id === route.params.photoId);

  const handleClose = useCallback(() => {
    const currentPhase = useMirrorTransition.getState().phase;
    if (currentPhase === "detail") {
      prepareClose();
    } else if (
      currentPhase === "preparing-open" ||
      currentPhase === "mounting-open" ||
      currentPhase === "opening" ||
      currentPhase === "finishing-open"
    ) {
      cancelOpening();
    }
  }, [cancelOpening, prepareClose]);

  usePreventRemove(
    Boolean(photo && position) && phase !== "finishing-close",
    handleClose,
  );

  useEffect(() => {
    let frame: number | null = null;

    if (phase === "preparing-open") {
      frame = requestAnimationFrame(mountMirror);
    } else if (phase === "mounting-open") {
      frame = requestAnimationFrame(startOpening);
    } else if (phase === "finishing-open") {
      frame = requestAnimationFrame(completeOpeningHandoff);
    } else if (phase === "preparing-close") {
      frame = requestAnimationFrame(startClosing);
    } else if (phase === "finishing-close") {
      frame = requestAnimationFrame(() => navigation.goBack());
    }

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [
    completeOpeningHandoff,
    mountMirror,
    navigation,
    phase,
    startClosing,
    startOpening,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!photo) {
        navigation.goBack();
      }
    }, [navigation, photo]),
  );

  if (!photo || !position) {
    return null;
  }

  const photoHeight = getPhotoHeight(screenWidth, photo.width, photo.height);
  const destinationTop = Math.max(
    safeArea.top,
    (screenHeight - photoHeight) / 2,
  );
  const destinationVisible = isDestinationVisible(phase);
  const status =
    phase === "detail" ? "detail / full-res" : `${phase} / ${mirrorSource}`;

  return (
    <View style={styles.screen} testID="mirror-image-detail-screen">
      <View
        pointerEvents="none"
        style={[
          styles.backdrop,
          destinationVisible ? styles.visible : styles.hidden,
        ]}
      />
      <View
        accessibilityElementsHidden={!destinationVisible}
        importantForAccessibility={
          destinationVisible ? "auto" : "no-hide-descendants"
        }
        pointerEvents="none"
        style={[
          styles.destination,
          destinationVisible ? styles.visible : styles.hidden,
          {
            height: photoHeight,
            top: destinationTop,
            width: screenWidth,
          },
        ]}
        testID="mirror-gallery-destination"
      >
        <Portal
          name={getPortalName(photo.id, "full-res")}
          style={{ width: screenWidth, height: photoHeight }}
        >
          <Image
            accessibilityLabel="Loaded full-resolution photo"
            accessibilityIgnoresInvertColors
            fadeDuration={0}
            onError={cancelOpening}
            onLoad={() => markFullResLoaded(photo.id)}
            resizeMode="cover"
            source={{ uri: photo.fullSize }}
            style={styles.image}
            testID="mirror-gallery-full-res-image"
          />
        </Portal>
      </View>

      <MirrorTransition />

      {phase === "detail" ? (
        <Pressable
          accessibilityLabel="Close full-screen photo"
          accessibilityRole="button"
          onPress={handleClose}
          style={[styles.closeButton, { top: safeArea.top + 12 }]}
          testID="mirror-gallery-close"
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      ) : null}

      <View
        pointerEvents="none"
        style={[styles.statusPill, { bottom: safeArea.bottom + 16 }]}
      >
        <Text style={styles.statusText} testID="mirror-gallery-source-status">
          {status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "transparent",
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050505",
  },
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
  },
  destination: {
    left: 0,
    overflow: "hidden",
    position: "absolute",
    zIndex: 10,
  },
  image: {
    height: "100%",
    width: "100%",
  },
  closeButton: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    position: "absolute",
    right: 16,
    zIndex: 30,
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  statusPill: {
    alignSelf: "center",
    backgroundColor: "rgba(43,43,43,0.92)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: "absolute",
    zIndex: 40,
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

export default MirrorPhotoDetail;
