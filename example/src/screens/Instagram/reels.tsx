import { ScrollView, View, StyleSheet } from "react-native";
import { posts } from "./posts";
import ReelsHeader from "./components/ReelsHeader";
import { SCREEN_HEIGHT } from "./constants";
import FullScreenReel from "./components/FullScreenReel";

export default function Reels({ route }) {
  const post = route.params.post;
  const reels = posts.filter((p) => p.id !== post.id && p.video);

  return (
    <View style={styles.container}>
      <ScrollView
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
      >
        <FullScreenReel post={post} portal />
        {reels.map((p) => (
          <FullScreenReel key={p.id} post={p} />
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
