import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import { View, Text } from "react-native";
import type { PostType } from "../posts";

type SocialSectionProps = {
  post: PostType;
};

function SocialSection({ post }: SocialSectionProps) {
  return (
    <View style={{ margin: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <FontAwesome6 name="heart" size={24} />
            <Text style={{ fontWeight: "600" }}>{post.likes}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
  );
}

export default SocialSection;
