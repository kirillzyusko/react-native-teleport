import { useState } from "react";
import { type ScrollEvent, StyleSheet, View } from "react-native";
import Reanimated, { useAnimatedProps } from "react-native-reanimated";

import FullScreenReel from "./components/FullScreenReel";
import ReelsHeader from "./components/ReelsHeader";
import { SCREEN_HEIGHT } from "./constants";
import { useTransition } from "./hooks/useTransition";
import { posts } from "./posts";

import type { ScreenNames } from "../../constants/screenNames";
import type { ExamplesStackParamList } from "../../navigation/ExamplesStack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type Props = NativeStackScreenProps<
  ExamplesStackParamList,
  ScreenNames.INSTAGRAM_REELS
>;

export default function Reels({ route }: Props) {
  const post = route.params.post;
  const reels = posts.filter((p) => p.id !== post.id && p.video);
  const [index, setIndex] = useState(0);
  const progress = useTransition((state) => state.progress);

  const onScroll = (e: ScrollEvent) => {
    const { y } = e.nativeEvent.contentOffset;

    setIndex(Math.round(y / SCREEN_HEIGHT));
  };

  const animatedProps = useAnimatedProps(
    () => ({
      // allow scroll only for reels screen
      scrollEnabled: progress.value === 1,
    }),
    [],
  );

  return (
    <View style={styles.container}>
      <Reanimated.ScrollView
        animatedProps={animatedProps}
        bounces={false}
        decelerationRate="fast"
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        onScroll={onScroll}
      >
        <FullScreenReel portal active={index === 0} post={post} />
        {reels.map((p, i) => (
          <FullScreenReel key={p.id} active={index === i + 1} post={p} />
        ))}
      </Reanimated.ScrollView>
      <ReelsHeader />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
