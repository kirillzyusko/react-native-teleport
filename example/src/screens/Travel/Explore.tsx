import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6/static";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CategoryCard from "./components/category-card/category-card";
import TravelInput from "./components/input/input";
import PlaceCard from "./components/place-card/place-card";
import Subheader from "./components/subheader/subheader";
import avatar from "./images/avatar.png";
import beach from "./images/beach.png";
import bromo from "./images/bromo.jpg";
import forest from "./images/forest.png";
import kuta from "./images/kuta.jpg";
import mountain from "./images/mountain.png";

export default function Login() {
  return (
    <SafeAreaView style={styles.view}>
      <View style={styles.textContainer}>
        <View style={styles.avatarContainer}>
          <Image source={avatar} style={styles.image} />
          <Text style={styles.avatarText}>Hello, Pristia!</Text>
        </View>
        <TouchableOpacity>
          <FontAwesome6
            iconStyle="regular"
            name="bell"
            size={20}
            style={styles.black}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.mainText}>Where do you want to explore today?</Text>
      <TravelInput />

      <Subheader subtext="Sell All" text="Choose Category" />
      <View>
        <ScrollView
          horizontal
          contentContainerStyle={styles.placeContainer}
          showsHorizontalScrollIndicator={false}
        >
          <CategoryCard image={beach} text="Beach" />
          <CategoryCard image={mountain} text="Mountain" />
          <CategoryCard image={forest} text="Forest" />
        </ScrollView>
      </View>
      <Subheader subtext="Explore" text="Favorite" />
      <ScrollView
        horizontal
        contentContainerStyle={styles.placeCardContainer}
        showsHorizontalScrollIndicator={false}
      >
        <PlaceCard
          header="Kuta Beach"
          image={kuta}
          rate="4.8"
          text="Bali, Indonesia"
        />
        <PlaceCard
          header={"Bromo Mountain"}
          image={bromo}
          rate="4.0"
          text={"Jawa Ti, Indonesia"}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  textContainer: {
    paddingHorizontal: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    textAlign: "center",
  },
  mainText: {
    paddingHorizontal: 30,
    color: "#1B1B1B",
    fontFamily: "Urbanist",
    fontWeight: 700,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.9,
  },

  view: {
    paddingTop: 30,
    gap: 30,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
    flex: 1,
  },

  avatarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  image: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  avatarText: {
    fontFamily: "Urbanist",
    fontWeight: 600,
    fontSize: 16,
    lineHeight: 26,
    color: "#0C0507",
  },

  placeContainer: {
    paddingHorizontal: 30,
    flexDirection: "row",
    gap: 10,
  },

  placeCardContainer: {
    paddingHorizontal: 30,
    flexDirection: "row",
    gap: 19.5,
  },

  black: {
    color: "#000000",
  },
});
