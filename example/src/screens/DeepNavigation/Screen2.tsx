import { useNavigation } from "@react-navigation/native";
import { Button, Text, View } from "react-native";

function Screen2() {
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Hello from second screen!</Text>
      <Button
        title="Go back"
        onPress={() => navigation.goBack()}
        testID="go_back"
      />
    </View>
  );
}

export default Screen2;
