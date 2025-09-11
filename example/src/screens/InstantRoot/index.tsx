import { useState } from "react";
import { View, StyleSheet, Button } from "react-native";
import { Portal } from "react-native-teleport";
import {
  GestureHandlerRootView,
  TouchableOpacity,
} from "react-native-gesture-handler";

export default function InstantRootExample() {
  const [isPressed, setPressed] = useState(false);
  const [shouldBeTeleported, setTeleported] = useState(true);

  return (
    <>
      <View style={styles.container}>
        <Portal hostName={shouldBeTeleported ? "overlay" : undefined}>
          <GestureHandlerRootView style={styles.wrapper}>
            <TouchableOpacity onPress={() => setPressed(true)}>
              <View style={styles.box} testID="touchable" />
            </TouchableOpacity>
          </GestureHandlerRootView>
        </Portal>
        <Button
          title={shouldBeTeleported ? "Move back" : "Move to portal"}
          onPress={() => setTeleported((t) => !t)}
        />
        <Button
          title={isPressed ? "OK" : "NOT TOUCHED"}
          onPress={() => setPressed(false)}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    width: 160,
    height: 160,
    marginVertical: 20,
    backgroundColor: "blue",
  },
  absolute: {
    position: "absolute",
  },
  wrapper: {
    flex: 0,
  },
});
