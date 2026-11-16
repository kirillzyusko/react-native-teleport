import { useNavigation } from "@react-navigation/native";
import { Button, Text, View } from "react-native";

function Screen2() {
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Hello from second screen!</Text>
      <Button
        testID="go_back"
        title="Go back"
        onPress={() => navigation.goBack()}
      />
    </View>
  );
}

export default Screen2;
