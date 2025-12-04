import { useState } from "react";
import { Button, View } from "react-native";
import { ScreenNames } from "../../constants/screenNames";
import { Portal } from "react-native-teleport";
import { useNavigation } from "@react-navigation/native";
import type { ExamplesStackNavigation } from "../../navigation/ExamplesStack";

function Screen1() {
  const [mounted, setMounted] = useState(true);
  const navigation = useNavigation<ExamplesStackNavigation>();

  return (
    <View style={{ flex: 1 }}>
      {mounted && (
        <Portal hostName="overlay">
          <View
            style={{
              height: 50,
              width: 50,
              backgroundColor: "red",
              position: "absolute",
              right: 0,
            }}
          />
        </Portal>
      )}
      <Button title="Unmount" onPress={() => setMounted(false)} />
      <Button title="Mount" onPress={() => setMounted(true)} />
      <Button
        title="Go to next screen"
        onPress={() =>
          navigation.navigate(ScreenNames.NAVIGATION_LIFECYCLE_NESTED)
        }
      />
    </View>
  );
}

export default Screen1;
