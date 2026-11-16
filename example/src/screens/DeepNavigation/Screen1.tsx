import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Button, View } from "react-native";
import { Portal } from "react-native-teleport";

import { ScreenNames } from "../../constants/screenNames";

import type { ExamplesStackNavigation } from "../../navigation/ExamplesStack";

function Screen1() {
  const [mounted, setMounted] = useState(true);
  const navigation = useNavigation<ExamplesStackNavigation>();

  return (
    <View style={{ flex: 1 }}>
      <Button
        testID="unmount"
        title="Unmount"
        onPress={() => setMounted(false)}
      />
      <Button testID="mount" title="Mount" onPress={() => setMounted(true)} />
      <Button
        testID="go_next"
        title="Go to next screen"
        onPress={() =>
          navigation.navigate(ScreenNames.NAVIGATION_LIFECYCLE_NESTED)
        }
      />
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
            testID="teleported_view"
          />
        </Portal>
      )}
    </View>
  );
}

export default Screen1;
