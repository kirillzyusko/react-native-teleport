import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import { View, Text, StyleSheet } from "react-native";
import type { PostType } from "../posts";

type SocialSectionProps = {
  post: PostType;
};

function SocialSection({ post }: SocialSectionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.iconGroup}>
          <View style={styles.icon}>
            <FontAwesome6 name="heart" size={24} />
            <Text style={styles.iconText}>{post.likes}</Text>
          </View>
          <View style={styles.icon}>
            <FontAwesome6 name="comments" size={24} />
            <Text style={styles.iconText}>{post.comments}</Text>
          </View>
          <FontAwesome6 name="paper-plane" size={24} />
        </View>
        <FontAwesome6 name="bookmark" size={24} />
      </View>
      <View style={styles.authorSection}>
        <Text style={styles.author}>{post.author}</Text>
        <Text style={styles.description}>{post.text}</Text>
      </View>
      <Text style={styles.date}>{post.date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconGroup: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  icon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconText: {
    fontWeight: "600",
  },
  description: {
    fontWeight: "400",
    color: "black",
  },
  date: { paddingTop: 4, color: "#5c5c5c" },
  authorSection: {
    paddingTop: 8,
    flexDirection: "row",
  },
  author: {
    fontWeight: "700",
    paddingRight: 4,
  },
});

export default SocialSection;
