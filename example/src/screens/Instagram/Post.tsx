import { View, StyleSheet, Image } from "react-native";
import type { PostType } from "./posts";
import Video, { ViewType } from "react-native-video";
import type { ExamplesStackNavigation } from "../../navigation/ExamplesStack";
import { useNavigation } from "@react-navigation/native";
import { useRef } from "react";
import { ScreenNames } from "../../constants/screenNames";
import {
  ASPECT_RATIO,
  CARD_HEIGHT,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  VIDEO_HEIGHT,
} from "./constants";
import { Portal } from "react-native-teleport";
import SocialSection from "./components/SocialSection";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";
import { useTransition } from "./hooks/useTransition";
import Reanimated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

type PostProps = {
  post: PostType;
  active: boolean;
};

const Post = ({ post, active }: PostProps) => {
  const navigation = useNavigation<ExamplesStackNavigation>();
  const { id, destination, setId, y, progress, goToReels } = useTransition();
  const videoRef = useRef<View>(null);

  const onPress = () => {
    if (post.photo) {
      // photos are not part of reels
      return;
    }
    setId(post.id);
    // @ts-expect-error I don't know what's wrong with types here
    videoRef.current?.measureInWindow((_x: number, _y: number) => {
      navigation.navigate(ScreenNames.INSTAGRAM_REELS, { post });
      goToReels(_y);
    });
  };
  const shouldMove = id === post.id;

  const frame = useAnimatedStyle(
    () => ({
      height: shouldMove
        ? interpolate(progress.value, [0, 1], [VIDEO_HEIGHT, SCREEN_HEIGHT])
        : VIDEO_HEIGHT,
      transform: [
        {
          translateY: shouldMove
            ? interpolate(progress.value, [0, 1], [0, -y])
            : 0,
        },
      ],
    }),
    [shouldMove, y],
  );

  return (
    <View style={{ height: CARD_HEIGHT }}>
      <TouchableWithoutFeedback onPress={onPress}>
        <View
          // @ts-expect-error I don't know what's wrong with types here
          ref={videoRef}
          style={styles.container}
        >
          <Portal hostName={shouldMove ? destination : undefined}>
            <Reanimated.View style={[{ width: "100%" }, frame]}>
              {post.video && (
                <Video
                  source={{ uri: post.video }}
                  style={[styles.video, { top: shouldMove ? y : 0 }]}
                  repeat
                  paused={!active}
                  controls={false}
                  resizeMode="cover"
                  viewType={ViewType.TEXTURE}
                />
              )}
              {post.photo && (
                <Image
                  source={{ uri: post.photo }}
                  style={{
                    height: VIDEO_HEIGHT,
                    width: SCREEN_WIDTH,
                    aspectRatio: ASPECT_RATIO,
                    position: "relative",
                  }}
                />
              )}
            </Reanimated.View>
          </Portal>
        </View>
      </TouchableWithoutFeedback>
      <SocialSection post={post} />
    </View>
  );
};

export default Post;

const styles = StyleSheet.create({
  // preserve content space when view teleported, so that scroll position remains unchanged
  // and we accidentally don't switch another video to play
  container: {
    height: VIDEO_HEIGHT,
    width: "100%",
  },
  video: {
    flex: 1,
    position: "relative",
    objectFit: "cover",
  },
});
