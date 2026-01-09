import { useState } from "react";
import { View, StyleSheet, type ScrollEvent } from "react-native";
import Reanimated, { useAnimatedProps } from "react-native-reanimated";
import { CARD_HEIGHT } from "./constants";
import { posts } from "./posts";
import Post from "./Post";
import { useTransition } from "./hooks/useTransition";

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
      <Reanimated.ScrollView onScroll={onScroll} animatedProps={animatedProps}>
        {posts.map((post, i) => (
          <Post active={index === i} key={post.id} post={post} />
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
