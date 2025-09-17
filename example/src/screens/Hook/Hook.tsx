import { useState } from "react";
import { View, StyleSheet, Button } from "react-native";
import { Portal, PortalHost, usePortal } from "react-native-teleport";

export default function Hook() {
  const [_, setN] = useState(0);
  const { removePortal } = usePortal("local");

  return (
    <>
      <View style={styles.absolute}>
        <PortalHost name="local" />
      </View>
      <View style={styles.container}>
        <Portal hostName={"local"} name="portal">
          <View style={styles.box} testID="touchable" />
        </Portal>
        <Button title="Force re-render" onPress={() => setN((n) => n + 1)} />
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
