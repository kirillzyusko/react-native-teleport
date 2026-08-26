import React, { useCallback, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Portal } from "react-native-teleport";

import useMeasure from "../../hooks/useMeasure";
import { getPhotoHeight, getPortalName } from "./constants";
import type { Photo } from "./photos";
import {
  isThumbnailVisible,
  useMirrorTransition,
  type ThumbnailPosition,
} from "./transition";

type Props = {
  index: number;
  photo: Photo;
  screenWidth: number;
  thumbnailSize: number;
  onOpen: (photo: Photo, position: ThumbnailPosition) => void;
};

function MirrorPhotoPreview({
  index,
  photo,
  screenWidth,
  thumbnailSize,
  onOpen,
}: Props) {
  const frameRef = useRef<View>(null);
  const measure = useMeasure(frameRef);
  const phase = useMirrorTransition((state) => state.phase);
  const isSelected = useMirrorTransition(
    (state) => state.photo?.id === photo.id,
  );

  const imageHeight = getPhotoHeight(screenWidth, photo.width, photo.height);
  const coverScale = Math.max(
    thumbnailSize / screenWidth,
    thumbnailSize / imageHeight,
  );
  const sourceStyle = {
    width: screenWidth,
    height: imageHeight,
    transformOrigin: "0% 0%" as const,
    transform: [
      {
        translateX: (thumbnailSize - screenWidth * coverScale) / 2,
      },
      {
        translateY: (thumbnailSize - imageHeight * coverScale) / 2,
      },
      { scale: coverScale },
    ],
  };

  const handlePress = useCallback(() => {
    if (useMirrorTransition.getState().phase !== "idle") {
      return;
    }

    measure((x, y) => {
      onOpen(photo, { x, y, width: thumbnailSize });
    });
  }, [measure, onOpen, photo, thumbnailSize]);

  const sourceOpacity = isSelected && !isThumbnailVisible(phase) ? 0 : 1;

  return (
    <Pressable
      accessibilityLabel={`Open photo ${index + 1}`}
      accessibilityRole="button"
      disabled={phase !== "idle"}
      onPress={handlePress}
      style={{ width: thumbnailSize, height: thumbnailSize }}
      testID={`mirror-gallery-photo-${index + 1}`}
    >
      <View
        // @ts-expect-error ref type mismatch between View component and host instance
        ref={frameRef}
        style={styles.frame}
      >
        <View style={[styles.source, { opacity: sourceOpacity }]}>
          <Portal name={getPortalName(photo.id, "low-res")} style={sourceStyle}>
            <Image
              accessibilityIgnoresInvertColors
              fadeDuration={0}
              resizeMode="cover"
              source={{ uri: photo.thumbnail }}
              style={styles.image}
            />
          </Portal>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>LOW</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: "#ded9d0",
    flex: 1,
    overflow: "hidden",
  },
  source: {
    flex: 1,
  },
  image: {
    height: "100%",
    width: "100%",
  },
  badge: {
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 5,
    bottom: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: "absolute",
    right: 6,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});

export default React.memo(MirrorPhotoPreview);
