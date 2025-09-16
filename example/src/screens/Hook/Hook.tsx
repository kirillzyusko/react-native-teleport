import { useState } from "react";
import { View, StyleSheet, Button, TouchableOpacity } from "react-native";
import { Portal, PortalHost, usePortal } from "react-native-teleport";

export default function Hook() {
  const [isPressed, setPressed] = useState(false);
  const [shouldBeTeleported, setTeleported] = useState(false);
  const { removePortal } = usePortal("local");

  return (
    <>
      <View style={styles.absolute}>
        <PortalHost name="local" />
      </View>
      <View style={styles.container}>
        <Portal hostName={"local"} name="portal">
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
        <Button title="Remove" onPress={() => removePortal("portal")} />
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
