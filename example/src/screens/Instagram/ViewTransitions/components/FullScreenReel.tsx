import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Video from "react-native-video";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../constants";
import type { PostType } from "../posts";
import { useState } from "react";
import { getViewTransitionStyle } from "../viewTransition";
import { useViewTransition } from "../hooks/useViewTransition";

type FullScreenReelProps = {
  post: PostType;
  active: boolean;
  transitionName?: string;
};

function FullScreenReel({ post, active, transitionName }: FullScreenReelProps) {
  const [isLiked, setLiked] = useState(false);
  const isTransitioning = useViewTransition(
    (state) => state.isRunning && state.postId === post.id,
  );

  const onToggleLike = () => {
    setLiked((l) => !l);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.videoFrame, getViewTransitionStyle(transitionName)]}>
        <Video
          source={{ uri: post.video }}
          style={styles.video}
          paused={!active || isTransitioning}
          repeat
          resizeMode="cover"
        />
      </View>
      <View style={styles.icons}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoFrame: {
    height: SCREEN_HEIGHT,
    width: SCREEN_WIDTH,
    overflow: "hidden",
  },
  video: {
    height: SCREEN_HEIGHT,
    width: SCREEN_WIDTH,
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
