import {
  View,
  Image,
  Text,
  StyleSheet,
  type ImageProps,
  TouchableOpacity,
} from "react-native";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import LinearGradient from "react-native-linear-gradient";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { ScreenNames } from "../../../../constants/screenNames";
import type { ExamplesStackNavigation } from "../../../../navigation/ExamplesStack";

import Hero from "../../hero";

type Props = {
  text: string;
  header: string;
  rate: string;
  image: ImageProps["source"];
};

export default function PlaceCard({ text, image, header, rate }: Props) {
  const [liked, setLiked] = useState(false);
  const navigation = useNavigation<ExamplesStackNavigation>();

  const handlePress = () => {
    liked ? setLiked(false) : setLiked(true);
  };
  const handleCardPress = () => {
    navigation.navigate(ScreenNames.TRAVEL_DETAILS, {
      image: image,
      header: header,
      text: text,
      location: text,
      rating: rate,
    });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.card}
      onPress={handleCardPress}
    >
      <Image style={styles.card} source={image} />
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.89)"]}
        style={[styles.card, styles.absolute]}
      >
        <View style={styles.content}>
          <Hero.Text id={header} style={styles.header}>
            {header}
          </Hero.Text>
          <View style={styles.container}>
            <FontAwesome6
              name="location-dot"
              iconStyle="solid"
              size={12}
              style={styles.white}
            />
            <Text style={styles.text}>{text}</Text>
          </View>
          <View style={styles.container}>
            <View style={styles.container}>
              <FontAwesome6
                name="star"
                iconStyle="solid"
                size={12}
                style={styles.yellow}
              />
              <FontAwesome6
                name="star"
                iconStyle="solid"
                size={12}
                style={styles.yellow}
              />
              <FontAwesome6
                name="star"
                iconStyle="solid"
                size={12}
                style={styles.yellow}
              />
              <FontAwesome6
                name="star"
                iconStyle="solid"
                size={12}
                style={styles.yellow}
              />
              <FontAwesome6
                name="star"
                iconStyle="solid"
                size={12}
                style={styles.white}
              />
            </View>
            <Text style={styles.rate}>{rate}</Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.5}
          style={styles.likeContainer}
          onPress={handlePress}
        >
          <FontAwesome6
            name="heart"
            iconStyle={liked ? "solid" : "regular"}
            size={16}
            color={liked ? "#FD5B1F" : "#161616"}
          />
        </TouchableOpacity>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 186,
    height: 246,
    borderRadius: 20,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  text: {
    fontFamily: "Urbanist",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: 25,
    color: "#FFFFFF",
  },
  rate: {
    fontFamily: "Urbanist",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: 24,
    color: "#FFFFFF",
  },

  absolute: {
    position: "absolute",
    justifyContent: "flex-end",
  },
  content: {
    padding: 15,
  },
  header: {
    fontFamily: "Urbanist",
    fontWeight: 600,
    fontSize: 20,
    lineHeight: 30,
    color: "#FFFFFF",
  },

  gradient: {
    flex: 1,
    justifyContent: "flex-end",
  },

  likeContainer: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "center",
    top: 16,
    right: 16,
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
  },

  yellow: { color: "#FCD240" },

  white: { color: "#FFFFFF" },
});
