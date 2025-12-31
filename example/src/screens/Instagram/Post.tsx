import { Animated, View, StyleSheet, Image } from "react-native";
import type { PostType } from "./posts";
import Video from "react-native-video";
import type { ExamplesStackNavigation } from "../../navigation/ExamplesStack";
import { useNavigation } from "@react-navigation/native";
import { useRef, useState } from "react";
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

type PostProps = {
  post: PostType;
  active: boolean;
};

const AnimatedVideo = Animated.createAnimatedComponent(Video);

const Post = ({ post, active }: PostProps) => {
  const navigation = useNavigation<ExamplesStackNavigation>();
  const progress = useRef(new Animated.Value(0)).current;
  const layout = useRef(new Animated.Value(0)).current;
  const [destination, setDestination] = useState<string>();
  const videoRef = useRef<View>(null);
  const [y, setY] = useState(0);

  const onPress = () => {
    // @ts-expect-error I don't know what's wrong with types here
    videoRef.current?.measureInWindow((_x: number, _y: number) => {
      setY(_y);
      setDestination("overlay");
      navigation.navigate(ScreenNames.INSTAGRAM_REELS, { post });
      Animated.spring(progress, {
        toValue: 1,
        mass: 3,
        damping: 500,
        stiffness: 1000,
        useNativeDriver: true,
      }).start(() => {
        // TODO: fix bugs
        // - dismiss screen - return element back to feed
        // - why on Android video becomes black for a fraction of a second? Happens only after teleportation into destination? Timing issue (wrap in setTimeout?) Layout issue? Pausing/resetting issue? Xiaomi API 28 still have issue, looks like it has been fixed on real devices starting from API 29+ I can not reproduce issue on Pixel 7 Pro Android 16
        setDestination("reels");
      });
      Animated.spring(layout, {
        toValue: 1,
        mass: 3,
        damping: 500,
        stiffness: 1000,
        useNativeDriver: false,
      }).start();
    });
  };

  return (
    <View style={{ height: CARD_HEIGHT }}>
      <TouchableWithoutFeedback onPress={onPress}>
        <View
          // @ts-expect-error I don't know what's wrong with types here
          ref={videoRef}
          // preserve content space when view teleported, so that scroll position remains unchanged
          // and we accidentally don't switch another video to play
          style={{ width: "100%", height: VIDEO_HEIGHT }}
        >
          <Portal hostName={destination}>
            <Animated.View
              style={{
                height: VIDEO_HEIGHT,
                width: "100%",
                transform: [
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -y],
                    }),
                  },
                ],
              }}
            >
              {post.video && (
                <AnimatedVideo
                  source={{ uri: post.video }}
                  style={[
                    styles.video,
                    { top: y },
                    {
                      height: layout.interpolate({
                        inputRange: [0, 1],
                        outputRange: [VIDEO_HEIGHT, SCREEN_HEIGHT],
                      }),
                    },
                  ]}
                  repeat
                  paused={!active}
                  controls={false}
                  resizeMode="cover"
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
                    top: y,
                  }}
                />
              )}
            </Animated.View>
          </Portal>
        </View>
      </TouchableWithoutFeedback>
      <SocialSection post={post} />
    </View>
  );
};

export default Post;

const styles = StyleSheet.create({
  video: {
    width: SCREEN_WIDTH,
    position: "relative",
    objectFit: "cover",
  },
});
