import { Image, StyleSheet, Text, View, type ImageProps } from "react-native";
import Button from "../Travel/components/button/button";
import LinearGradient from "react-native-linear-gradient";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ExamplesStackParamList } from "../../navigation/ExamplesStack";
import type { ScreenNames } from "../../constants/screenNames";

type Props = {
  image: ImageProps["source"];
  header: string;
  text: string;
  location: string;
  substring?: string;
  description?: string;
  buttonText: string;
  rating?: string;
  price?: string;
};

const DetailScreen = ({
  image,
  header,
  text,
  location,
  description,
  substring,
  rating,
  price,
  buttonText,
}: Props) => {
  return (
    <View style={styles.screen}>
      <Image style={styles.image} source={image} />
      <View style={styles.mainContainer}>
        <LinearGradient
          colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.89)"]}
          style={styles.gradient}
        >
          <View style={styles.view}>
            <View style={styles.verification}>
              <Text style={styles.heading}>{text}</Text>
              <Image
                source={require("./images/verify.png")}
                style={styles.verificationImage}
              />
            </View>
            <Text style={styles.mainText}>{header}</Text>
            <View style={styles.verification}>
              <FontAwesome6
                name="location-dot"
                iconStyle="solid"
                size={18}
                style={styles.white}
              />
              <Text style={styles.location}>{location}</Text>
            </View>
            <View style={[styles.verification, styles.textContainer]}>
              <Text>
                <Text style={styles.heading}>{substring}</Text>
                <Text style={styles.smallText}>people have explored</Text>
              </Text>
              <Image source={require("./images/group1.png")} />
            </View>
            <Text style={[styles.smallText]}>{description}</Text>
            <View style={[styles.textContainer, styles.mt30]}>
              <View style={styles.verification}>
                <FontAwesome6
                  name="star"
                  iconStyle="solid"
                  size={18}
                  style={styles.yellow}
                />
                <Text style={styles.numbers}>{rating}</Text>
              </View>
              <View>
                <FontAwesome6
                  name="arrow-down"
                  iconStyle="solid"
                  size={18}
                  style={styles.white}
                />
              </View>
            </View>
            <View
              style={[styles.verification, styles.textContainer, styles.mt50]}
            >
              <Text>
                <Text style={styles.numbers}>{price}</Text>
                <Text style={styles.smallText}>/ Person </Text>
              </Text>
              <Button text={buttonText} />
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
};

type DetailsProps = NativeStackScreenProps<
  ExamplesStackParamList,
  ScreenNames.TRAVEL_DETAILS
>;

export default function Detail({ route }: DetailsProps) {
  const { image, header, location, rating } = route.params;

  return (
    <DetailScreen
      image={image}
      header={header}
      text="FAVORITE PLACE"
      location={location}
      description="Bali is an island in Indonesia known for its verdant volcanoes, unique rice terraces, beaches, and beautiful coral reefs. Before becoming a tourist attraction, Kuta was a trading port where local products were traded to buyers from outside Bali."
      substring="100+ "
      rating={rating}
      price="$245,00 "
      buttonText="Booking"
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  image: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: -1,
  },
  view: {
    marginHorizontal: 30,
    gap: 10,
    bottom: 20,
  },

  mainContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },

  gradient: {
    flex: 0.8,
    justifyContent: "flex-end",
  },
  mainText: {
    fontFamily: "Urbanist",
    fontWeight: 700,
    fontSize: 36,
    lineHeight: 46,
    color: "#FFFFFF",
    zIndex: 1,
    letterSpacing: 0.9,
  },
  smallText: {
    fontFamily: "Urbanist",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: 25,
    color: "#FFFFFF",
    letterSpacing: 0.39,
  },
  heading: {
    fontFamily: "Urbanist",
    fontWeight: 900,
    fontSize: 11,
    lineHeight: 22,
    color: "#FFFFFF",
    letterSpacing: 0.25,
    alignSelf: "stretch",
    textAlign: "center",
  },
  location: {
    fontFamily: "Urbanist",
    fontWeight: 900,
    fontSize: 16,
    lineHeight: 22,
    color: "#FFFFFF",
    letterSpacing: 0.25,
  },
  verification: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  textContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    textAlign: "center",
  },

  numbers: {
    fontFamily: "Urbanist",
    fontWeight: 600,
    fontSize: 16,
    lineHeight: 26,
    color: "#FFFFFF",
    letterSpacing: 0.32,
    textTransform: "uppercase",
  },

  mt50: {
    marginTop: 50,
  },
  mt30: {
    marginTop: 30,
  },

  yellow: {
    color: "#FCD240",
  },

  white: {
    color: "#FFFFFF",
  },

  verificationImage: {
    width: 18,
    height: 18,
  },
});
