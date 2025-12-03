import { useNavigation } from "@react-navigation/native";
import { useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  View,
  Text,
  type ScrollEvent,
  Image,
} from "react-native";
import { Portal } from "react-native-teleport";
import Video from "react-native-video";
import { ScreenNames } from "../../constants/screenNames";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";
import {
  ASPECT_RATION,
  CARD_HEIGHT,
  SCREEN_WIDTH,
  VIDEO_HEIGHT,
} from "./constants";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import { type PostType, posts } from "./posts";
import type { ExamplesStackNavigation } from "../../navigation/ExamplesStack";

type PostProps = {
  post: PostType;
  active: boolean;
};

const Post = ({ post, active }: PostProps) => {
  const navigation = useNavigation<ExamplesStackNavigation>();
  const progress = useRef(new Animated.Value(0)).current;
  const [destination, setDestination] = useState<string>();
  const videoRef = useRef<View>(null);
  const [y, setY] = useState(0);

  const onPress = () => {
    // @ts-expect-error I don't know what's wrong with types here
    videoRef.current?.measureInWindow((_x: number, _y: number) => {
      setY(_y);
      setDestination("overlay");
      navigation.navigate(ScreenNames.INSTAGRAM_REELS);
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
    });
  };

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -y],
  });

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
                transform: [{ translateY: translateY }],
              }}
            >
              {post.video && (
                <Video
                  source={{ uri: post.video }}
                  style={[
                    {
                      height: VIDEO_HEIGHT,
                      width: SCREEN_WIDTH,
                      aspectRatio: ASPECT_RATION,
                      position: "relative",
                    },
                    { top: y },
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
                    aspectRatio: ASPECT_RATION,
                    position: "relative",
                    top: y,
                  }}
                />
              )}
            </Animated.View>
          </Portal>
        </View>
      </TouchableWithoutFeedback>
      <View style={{ margin: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <FontAwesome6 name="heart" size={24} />
              <Text style={{ fontWeight: "600" }}>{post.likes}</Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <FontAwesome6 name="comments" size={24} />
              <Text style={{ fontWeight: "600" }}>{post.comments}</Text>
            </View>
            <FontAwesome6 name="paper-plane" size={24} />
          </View>
          <FontAwesome6 name="bookmark" size={24} />
        </View>
        <View style={{ paddingTop: 8, flexDirection: "row" }}>
          <Text style={{ fontWeight: "700", paddingRight: 4 }}>
            {post.author}
          </Text>
          <Text style={{ fontWeight: "400" }}>{post.text}</Text>
        </View>
        <Text style={{ paddingTop: 4, color: "#5c5c5c" }}>{post.date}</Text>
      </View>
    </View>
  );
};

export default function Feed() {
  const [index, setIndex] = useState(0);

  const onScroll = (e: ScrollEvent) => {
    const { y } = e.nativeEvent.contentOffset;

    // TODO: enable next video when you scrolled 50-60% of CURRENT video
    setIndex(Math.floor(y / (CARD_HEIGHT * 0.75)));
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView onScroll={onScroll}>
        {posts.map((post, i) => (
          <Post active={index === i} key={post.id} post={post} />
        ))}
      </ScrollView>
    </View>
  );
}
