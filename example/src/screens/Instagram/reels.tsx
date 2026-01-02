import { ScrollView, View, StyleSheet, type ScrollEvent } from "react-native";
import { posts } from "./posts";
import ReelsHeader from "./components/ReelsHeader";
import { SCREEN_HEIGHT } from "./constants";
import FullScreenReel from "./components/FullScreenReel";
import { useState } from "react";

export default function Reels({ route }) {
  const post = route.params.post;
  const reels = posts.filter((p) => p.id !== post.id && p.video);
  const [index, setIndex] = useState(0);

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
      >
        <FullScreenReel post={post} portal active={index === 0} />
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
