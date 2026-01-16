import { Image, StyleSheet, Text, View } from "react-native";
import TravelInput from "./components/input/input";
import { SafeAreaView } from "react-native-safe-area-context";
import Subheader from "./components/subheader/subheader";
import CategoryCard from "./components/category-card/category-card";

export default function Login() {
  return (
    <SafeAreaView style={styles.view}>
      <View style={styles.textContainer}>
        <View style={styles.avatarContainer}>
          <Image style={styles.image} source={require("./images/avatar.png")} />
          <Text style={styles.avatarText}> Hello, Pristia!</Text>
        </View>
        <Image
          style={styles.image}
          source={require("./images/notification.png")}
        />
      </View>

      <Text style={styles.mainText}>Where do you want to explore today?</Text>
      <TravelInput style={styles.margin} />

      <Subheader text="Choose Category" subtext="Sell All" />
      <CategoryCard text="Beach" image={require("./images/beach.png")} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  margin: {
    marginBottom: 27,
  },

  textContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    textAlign: "center",
  },
  mainText: {
    color: "#1B1B1B",
    fontFamily: "Urbanist",
    fontWeight: 700,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.9,
  },

  view: {
    paddingTop: 30,
    paddingHorizontal: 30,
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

  avatarText: {
    fontFamily: "Urbanist",
    fontWeight: 600,
    fontSize: 16,
    lineHeight: 26,
    color: "#0C0507",
  },
});
