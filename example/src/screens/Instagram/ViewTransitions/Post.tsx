import { View, StyleSheet, Image } from "react-native";
import type { PostType } from "./posts";
import Video, { ViewType } from "react-native-video";
import type { ExamplesStackNavigation } from "../../../navigation/ExamplesStack";
import { useNavigation } from "@react-navigation/native";
import { ScreenNames } from "../../../constants/screenNames";
import {
  ASPECT_RATIO,
  CARD_HEIGHT,
  SCREEN_WIDTH,
  VIDEO_HEIGHT,
} from "./constants";
import SocialSection from "./components/SocialSection";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";
import { useViewTransition } from "./hooks/useViewTransition";
import {
  ACTIVE_REEL_TRANSITION_NAME,
  getViewTransitionStyle,
  prepareViewTransition,
  runViewTransition,
} from "./viewTransition";

type PostProps = {
  post: PostType;
  active: boolean;
};

const Post = ({ post, active }: PostProps) => {
  const finishTransition = useViewTransition((state) => state.finishTransition);
  const setRunning = useViewTransition((state) => state.setRunning);
  const setTarget = useViewTransition((state) => state.setTarget);
  const transitionName = useViewTransition((state) =>
    state.owner === "feed" && state.postId === post.id
      ? ACTIVE_REEL_TRANSITION_NAME
      : undefined,
  );
  const navigation = useNavigation<ExamplesStackNavigation>();

  const onPress = () => {
    if (post.photo) {
      // photos are not part of reels
      return;
    }

    prepareViewTransition(() => {
      setRunning(true);
      setTarget(post.id, "feed");
    });

    runViewTransition(
      () => {
        setTarget(post.id, "reels");
        navigation.navigate(ScreenNames.INSTAGRAM_VIEW_TRANSITIONS_REELS, {
          post,
        });
      },
      "to-reels",
      finishTransition,
    );
  };

  return (
    <View style={{ height: CARD_HEIGHT }}>
      <TouchableWithoutFeedback onPress={onPress}>
        <View style={styles.container}>
          <View
            style={[styles.mediaFrame, getViewTransitionStyle(transitionName)]}
          >
            {post.video && (
              <Video
                source={{ uri: post.video }}
                style={styles.video}
                repeat
                paused={!active}
                controls={false}
                resizeMode="cover"
                viewType={ViewType.TEXTURE}
              />
            )}
            {post.photo && (
              <Image source={{ uri: post.photo }} style={styles.photo} />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
      <SocialSection post={post} />
    </View>
  );
};

export default Post;

const styles = StyleSheet.create({
  container: {
    height: VIDEO_HEIGHT,
    width: "100%",
  },
  mediaFrame: {
    height: VIDEO_HEIGHT,
    width: SCREEN_WIDTH,
    overflow: "hidden",
  },
  video: {
    height: VIDEO_HEIGHT,
    width: SCREEN_WIDTH,
    position: "relative",
    objectFit: "cover",
  },
  photo: {
    height: VIDEO_HEIGHT,
    width: SCREEN_WIDTH,
    aspectRatio: ASPECT_RATIO,
    position: "relative",
  },
});
