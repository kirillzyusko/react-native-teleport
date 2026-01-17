import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

export default function TravelInput() {
  return (
    <View>
      <TextInput
        placeholder="Search destination"
        style={styles.input}
        placeholderTextColor={"#BABABA"}
      />
      <TouchableOpacity style={styles.image}>
        <FontAwesome6
          name="magnifying-glass"
          iconStyle="solid"
          size={20}
          color={"black"}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    marginHorizontal: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    paddingLeft: 20,
    paddingTop: 18,
    paddingRight: 16,
    paddingBottom: 18,
    fontSize: 14,
    fontFamily: "Urbanist",
    fontWeight: 400,
    letterSpacing: 0.25,
    backgroundColor: "#FAFAFA",
  },
  image: {
    position: "absolute",
    right: 50,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
