import { ScrollView, View } from "react-native";
import { PortalHost } from "react-native-teleport";
import { posts } from "./posts";
import ReelsHeader from "./components/ReelsHeader";

export default function Reels({ route }) {
  const reels = posts.filter(
    (post) => post.id !== route.params.post.id || post.video,
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView>
        <PortalHost name="reels" />
        {reels.map((post) => null)}
      </ScrollView>
      <ReelsHeader />
    </View>
  );
}
