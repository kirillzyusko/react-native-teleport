import { ScrollView, View, StyleSheet } from "react-native";
import { PortalHost } from "react-native-teleport";
import { posts } from "./posts";
import ReelsHeader from "./components/ReelsHeader";
import { SCREEN_HEIGHT } from "./constants";

export default function Reels({ route }) {
  const reels = posts.filter(
    (post) => post.id !== route.params.post.id || post.video,
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        <PortalHost name="reels" style={styles.host} />
        {reels.map((post) => null)}
      </ScrollView>
      <ReelsHeader />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  host: {
    height: SCREEN_HEIGHT,
    width: "100%",
  },
});
