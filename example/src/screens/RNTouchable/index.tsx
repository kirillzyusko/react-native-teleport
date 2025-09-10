import { useState } from "react";
import { View, StyleSheet, Button, TouchableOpacity } from "react-native";
import { Portal, PortalHost } from "react-native-teleport";

export default function RNTouchableExample() {
  const [isPressed, setPressed] = useState(false);
  const [shouldBeTeleported, setTeleported] = useState(false);

  return (
    <>
      <View style={styles.container}>
        <Portal hostName={shouldBeTeleported ? "local" : undefined}>
          <TouchableOpacity onPress={() => setPressed(true)}>
            <View style={styles.box} testID="touchable" />
          </TouchableOpacity>
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
      <View style={styles.absolute}>
        <PortalHost name="local" />
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
