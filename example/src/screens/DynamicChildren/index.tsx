import { useState } from "react";
import { View, StyleSheet, Button } from "react-native";
import { Portal, PortalHost } from "react-native-teleport";

export default function RNTouchableExample() {
  const [showChild, setShowChild] = useState(false);
  const [shouldBeTeleported, setTeleported] = useState(false);

  return (
    <>
      <View style={styles.container}>
        <Portal hostName={shouldBeTeleported ? "local" : undefined}>
          <View>
            <View style={styles.box} testID="touchable" />
            {showChild && <View style={styles.rectangle} />}
          </View>
        </Portal>
        <Button
          title={shouldBeTeleported ? "Move back" : "Move to portal"}
          onPress={() => setTeleported((t) => !t)}
        />
        <Button
          title={showChild ? "Remove child" : "Add child"}
          onPress={() => setShowChild((s) => !s)}
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
  rectangle: {
    width: 160,
    height: 60,
    backgroundColor: "red",
  },
  absolute: {
    position: "absolute",
  },
  wrapper: {
    flex: 0,
  },
});
