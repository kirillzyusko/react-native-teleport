import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6/static";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import { Portal, PortalHost } from "react-native-teleport";
import Video from "react-native-video";

import {
  FLOATING_ELEMENTS_DESTINATION,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from "../constants";
import { useTransition } from "../hooks/useTransition";

import type { PostType } from "../posts";

type FullScreenReelProps = {
  post: PostType;
  portal?: boolean;
  active: boolean;
};

function FullScreenReel({ post, active, portal = false }: FullScreenReelProps) {
  const [isLiked, setLiked] = useState(false);
  const progress = useTransition((state) => state.progress);
  const destination = useTransition((state) => state.destination);

  const icons = useAnimatedStyle(
    () => ({
      opacity: progress.value,
    }),
    [],
  );

  const onToggleLike = () => {
    setLiked((l) => !l);
  };

  return (
    <View style={styles.container}>
      {portal ? (
        <PortalHost name="reels" style={styles.container} />
      ) : (
        <Video
          paused={!active}
          resizeMode="cover"
          source={{ uri: post.video }}
          style={styles.video}
        />
      )}
      <Portal
        hostName={
          portal && destination === "overlay"
            ? FLOATING_ELEMENTS_DESTINATION
            : undefined
        }
      >
        <Reanimated.View style={[styles.icons, icons]}>
          <View>
            <TouchableOpacity onPress={onToggleLike}>
              <FontAwesome6
                color={isLiked ? "red" : "white"}
                iconStyle={isLiked ? "solid" : "regular"}
                name="heart"
                size={24}
                style={styles.icon}
              />
            </TouchableOpacity>
            <Text style={styles.text}>
              {isLiked ? post.likes + 1 : post.likes}
            </Text>
          </View>
          <View>
            <FontAwesome6
              color="white"
              name="comments"
              size={24}
              style={styles.icon}
            />
            <Text style={styles.text}>{post.comments}</Text>
          </View>
          <View>
            <FontAwesome6
              color="white"
              name="paper-plane"
              size={24}
              style={styles.icon}
            />
            <Text style={styles.text}>{post.sent}</Text>
          </View>
          <View>
            <FontAwesome6
              color="white"
              iconStyle="solid"
              name="ellipsis"
              size={22}
              style={styles.icon}
            />
          </View>
        </Reanimated.View>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  video: {
    flex: 1,
    objectFit: "cover",
  },
  icons: {
    position: "absolute",
    bottom: 32,
    right: 12,
  },
  icon: {
    textAlign: "center",
  },
  text: {
    paddingTop: 8,
    paddingBottom: 16,
    color: "white",
    fontWeight: "500",
    textAlign: "center",
  },
});

export default FullScreenReel;
