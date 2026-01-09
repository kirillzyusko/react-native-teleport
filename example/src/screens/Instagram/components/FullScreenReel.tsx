import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Video from "react-native-video";
import { Portal, PortalHost } from "react-native-teleport";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import {
  FLOATING_ELEMENTS_DESTINATION,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from "../constants";
import type { PostType } from "../posts";
import { useTransition } from "../hooks/useTransition";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import { useState } from "react";

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
          source={{ uri: post.video }}
          style={styles.video}
          paused={!active}
          resizeMode="cover"
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
                name="heart"
                iconStyle={isLiked ? "solid" : "regular"}
                size={24}
                color={isLiked ? "red" : "white"}
                style={styles.icon}
              />
            </TouchableOpacity>
            <Text style={styles.text}>
              {isLiked ? post.likes + 1 : post.likes}
            </Text>
          </View>
          <View>
            <FontAwesome6
              name="comments"
              size={24}
              color="white"
              style={styles.icon}
            />
            <Text style={styles.text}>{post.comments}</Text>
          </View>
          <View>
            <FontAwesome6
              name="paper-plane"
              size={24}
              color="white"
              style={styles.icon}
            />
            <Text style={styles.text}>{post.sent}</Text>
          </View>
          <View>
            <FontAwesome6
              name="ellipsis"
              iconStyle="solid"
              size={22}
              color="white"
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
