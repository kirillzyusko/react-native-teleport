import { useState } from "react";
import { type ScrollEvent, StyleSheet, View } from "react-native";
import Reanimated, { useAnimatedProps } from "react-native-reanimated";

import { CARD_HEIGHT } from "./constants";
import { useTransition } from "./hooks/useTransition";
import Post from "./Post";
import { posts } from "./posts";

export default function Feed() {
  const [index, setIndex] = useState(0);
  const progress = useTransition((state) => state.progress);

  const onScroll = (e: ScrollEvent) => {
    const { y } = e.nativeEvent.contentOffset;

    setIndex(Math.floor(y / (CARD_HEIGHT * 0.75)));
  };

  const animatedProps = useAnimatedProps(
    () => ({
      // allow scroll only for feed screen
      scrollEnabled: progress.value === 0,
    }),
    [],
  );

  return (
    <View style={styles.container}>
      <Reanimated.ScrollView animatedProps={animatedProps} onScroll={onScroll}>
        {posts.map((post, i) => (
          <Post key={post.id} active={index === i} post={post} />
        ))}
      </Reanimated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
