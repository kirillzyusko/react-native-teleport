import { useCallback } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenNames } from "../../constants/screenNames";
import type { ExamplesStackParamList } from "../../navigation/ExamplesStack";
import { COLUMNS, getThumbnailSize, GRID_GAP } from "./constants";
import MirrorPhotoPreview from "./MirrorPhotoPreview";
import PHOTOS, { type Photo } from "./photos";
import { useMirrorTransition, type ThumbnailPosition } from "./transition";

type Navigation = NativeStackNavigationProp<ExamplesStackParamList>;

function MirrorPhotoGallery() {
  const navigation = useNavigation<Navigation>();
  const { top: safeAreaTop, bottom: safeAreaBottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const phase = useMirrorTransition((state) => state.phase);
  const prepareOpen = useMirrorTransition((state) => state.prepareOpen);
  const reset = useMirrorTransition((state) => state.reset);
  const thumbnailSize = getThumbnailSize(screenWidth);

  useFocusEffect(
    useCallback(() => {
      if (useMirrorTransition.getState().phase !== "idle") {
        reset();
      }
    }, [reset]),
  );

  const openPhoto = useCallback(
    (photo: Photo, position: ThumbnailPosition) => {
      prepareOpen(photo, position);
      navigation.navigate(ScreenNames.MIRROR_IMAGE_DETAIL, {
        photoId: photo.id,
      });
    },
    [navigation, prepareOpen],
  );

  return (
    <View
      accessibilityElementsHidden={phase !== "idle"}
      importantForAccessibility={
        phase === "idle" ? "auto" : "no-hide-descendants"
      }
      style={styles.screen}
      testID="mirror-image-gallery-screen"
    >
      <View style={[styles.header, { paddingTop: safeAreaTop + 8 }]}>
        <Pressable
          accessibilityLabel="Back to examples"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          testID="mirror-gallery-back"
        >
          <Text style={styles.headerButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Mirror Image Gallery</Text>
          <Text style={styles.headerSubtitle}>
            Square crop → original aspect ratio
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        columnWrapperStyle={styles.row}
        data={PHOTOS}
        keyExtractor={(photo) => photo.id}
        numColumns={COLUMNS}
        renderItem={({ item, index }) => (
          <MirrorPhotoPreview
            index={index}
            onOpen={openPhoto}
            photo={item}
            screenWidth={screenWidth}
            thumbnailSize={thumbnailSize}
          />
        )}
      />

      <View
        pointerEvents="none"
        style={[styles.statusPill, { bottom: safeAreaBottom + 16 }]}
      >
        <Text style={styles.statusText} testID="mirror-gallery-source-status">
          {phase === "idle" ? "grid / low-res" : `${phase} / low-res`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f5f2ec",
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerButtonText: {
    color: "#171717",
    fontSize: 34,
    lineHeight: 36,
  },
  headerTitleBlock: {
    flex: 1,
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: "#171717",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSubtitle: {
    color: "#716b63",
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  statusPill: {
    alignSelf: "center",
    backgroundColor: "rgba(23,23,23,0.9)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: "absolute",
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

export default MirrorPhotoGallery;
