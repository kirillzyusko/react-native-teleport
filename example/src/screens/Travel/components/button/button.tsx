import { Text, TouchableOpacity, View } from "react-native";

type Props = {
  text: string;
  onPress: () => void;
};

export default function Button({ text, onPress }: Props) {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: "#FCD240",
        width: "50%",
        height: 50,
        paddingTop: 13,
        paddingRight: 24,
        paddingLeft: 24,
        borderRadius: 15,
      }}
      onPress={onPress}
    >
      <View>
        <Text
          style={{
            fontFamily: "Urbanist",
            fontWeight: 600,
            fontSize: 16,
            lineHeight: 26,
            textAlign: "center",
          }}
        >
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
