# Portal

## Props[​](#props "Direct link to Props")

### `name`[​](#name "Direct link to name")

The name of the portal. It's used to identify the portal in the context of the portal host.

### `hostName`[​](#hostname "Direct link to hostname")

The name of the portal host. It's used to identify the host where the content should be rendered.

### `children`[​](#children "Direct link to children")

The content that should be rendered in the portal.

## Example[​](#example "Direct link to Example")

```
import { useState } from "react";
import { View, StyleSheet, Button } from "react-native";
import { Portal } from "react-native-teleport";

export default function InstantRootExample() {
  const [shouldBeTeleported, setTeleported] = useState(true);

  return (
    <View style={styles.container}>
      {shouldBeTeleported && (
        <Portal hostName={"overlay"}>
          <View style={styles.box} testID="touchable" />
        </Portal>
      )}
      <Button
        title={shouldBeTeleported ? "Hide" : "Show"}
        onPress={() => setTeleported((t) => !t)}
      />
    </View>
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
});
```
