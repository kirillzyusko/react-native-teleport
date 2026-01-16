import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

type Props = {
  text: string;
  subtext: string;
};

export default function Subheader({ text, subtext }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{text}</Text>
      <TouchableOpacity>
        <Text style={styles.subtext}>{subtext}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
});
