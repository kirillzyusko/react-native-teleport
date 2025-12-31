import { useState } from "react";
import { ScrollView, View, type ScrollEvent } from "react-native";
import { CARD_HEIGHT } from "./constants";
import { posts } from "./posts";
import Post from "./Post";

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
