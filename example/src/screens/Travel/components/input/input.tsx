import {
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  inputLabel: string;
};

export default function TravelInput({ inputLabel }: Props) {
  return (
    <View>
      <TextInput
        placeholder="Search destination"
        style={styles.input}
        placeholderTextColor={"#BABABA"}
      />
      <TouchableOpacity style={styles.image}>
        <Image source={require("../../images/search.png")} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
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

  text: {
    fontFamily: "Urbanist",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: 25,
    color: "#BABABA",
    marginLeft: 5,
    marginRight: 5,
  },

  textContainer: {
    backgroundColor: "#FFFFFF",
    marginLeft: 20,
    position: "absolute",
    left: 30,
    top: -12,

    zIndex: 1,
  },

  image: {
    position: "absolute",
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
