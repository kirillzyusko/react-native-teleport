import { useState } from "react";
import { View, StyleSheet, type ScrollEvent } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { posts } from "./posts";
import ReelsHeader from "./components/ReelsHeader";
import { SCREEN_HEIGHT } from "./constants";
import FullScreenReel from "./components/FullScreenReel";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ExamplesStackParamList } from "../../../navigation/ExamplesStack";
import type { ScreenNames } from "../../../constants/screenNames";
import { useViewTransition } from "./hooks/useViewTransition";
import { ACTIVE_REEL_TRANSITION_NAME } from "./viewTransition";

type Props = NativeStackScreenProps<
  ExamplesStackParamList,
  ScreenNames.INSTAGRAM_VIEW_TRANSITIONS_REELS
>;

export default function Reels({ route }: Props) {
  const post = route.params.post;
  const reels = posts.filter((p) => p.id !== post.id && p.video);
  const [index, setIndex] = useState(0);
  const transitionName = useViewTransition((state) =>
    state.owner === "reels" && state.postId === post.id
      ? ACTIVE_REEL_TRANSITION_NAME
      : undefined,
  );

  const onScroll = (e: ScrollEvent) => {
    const { y } = e.nativeEvent.contentOffset;
    setIndex(Math.round(y / SCREEN_HEIGHT));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        overScrollMode="never"
        bounces={false}
      >
        <FullScreenReel
          post={post}
          active={index === 0}
          transitionName={transitionName}
        />
        {reels.map((p, i) => (
          <FullScreenReel key={p.id} post={p} active={index === i + 1} />
        ))}
      </ScrollView>
      <ReelsHeader />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
