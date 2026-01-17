import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import TravelInput from "./components/input/input";
import { SafeAreaView } from "react-native-safe-area-context";
import Subheader from "./components/subheader/subheader";
import CategoryCard from "./components/category-card/category-card";
import PlaceCard from "./components/place-card/place-card";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import avatar from "./images/avatar.png";
import beach from "./images/beach.png";
import mountain from "./images/mountain.png";
import forest from "./images/forest.png";
import kuta from "./images/kuta.jpg";
import bromo from "./images/bromo.jpg";

export default function Login() {
  return (
    <SafeAreaView style={styles.view}>
      <View style={styles.textContainer}>
        <View style={styles.avatarContainer}>
          <Image style={styles.image} source={avatar} />
          <Text style={styles.avatarText}> Hello, Pristia!</Text>
        </View>
        <TouchableOpacity>
          <FontAwesome6
            name="bell"
            iconStyle="regular"
            size={20}
            style={{ color: "#000000" }}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.mainText}>Where do you want to explore today?</Text>
      <TravelInput />

      <Subheader text="Choose Category" subtext="Sell All" />
      <View>
        <ScrollView
          contentContainerStyle={styles.placeContainer}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <CategoryCard text="Beach" image={beach} />
          <CategoryCard text="Mountain" image={mountain} />
          <CategoryCard text="Forest" image={forest} />
        </ScrollView>
      </View>
      <Subheader text="Favorite" subtext="Explore" />
      <ScrollView
        horizontal
        contentContainerStyle={styles.placeCardContainer}
        showsHorizontalScrollIndicator={false}
      >
        <PlaceCard
          image={kuta}
          header="Kuta Beach"
          text="Bali, Indonesia"
          rate="4.8"
        />
        <PlaceCard
          text={"Jawa Ti, Indonesia"}
          header={"Bromo Mountain"}
          rate="4.0"
          image={bromo}
        ></PlaceCard>
      </ScrollView>
      <></>
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
});
