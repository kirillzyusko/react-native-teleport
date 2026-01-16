import {
  View,
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
  type ImageProps,
} from "react-native";

type Props = {
  text: string;
  image: ImageProps["source"];
};

export default function CategoryCard({ text, image }: Props) {
  return (
    <View>
      <TouchableOpacity style={styles.container}>
        <View style={styles.imageView}>
          <Image style={styles.image} source={image}></Image>
        </View>
        <Text style={styles.text}>{text}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    borderColor: "#F3F3F3",
    borderRadius: 20,
    borderWidth: 1,
    padding: 5,
    paddingRight: 20,
    alignSelf: "flex-start",
    gap: 10,
  },
  text: {
    fontFamily: "Urbanist",
    fontWeight: 700,
    fontSize: 18,
    lineHeight: 26,
    color: "#0C0507",
  },
  subtext: {
    fontFamily: "Urbanist",
    fontWeight: 400,
    fontSize: 14,
    lineHeight: 24,
    color: "#BABABA",
  },

  image: {
    width: 24,
    height: 24,
  },

  imageView: {
    width: 44,
    height: 44,
    backgroundColor: "#f8f8f8",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
});
