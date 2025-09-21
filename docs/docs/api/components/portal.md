---
sidebar_position: 3
description: A component that moves its children to a different place in the view hierarchy.
keywords:
  [react-native-teleport, react-native teleport, react-native portal, portal]
---

# Portal

## Props

### `name`

The name of the portal. It's used to identify the portal in the context of the portal host.

### `hostName`

The name of the portal host. It's used to identify the host where the content should be rendered.

### `children`

The content that should be rendered in the portal.

## Example

```tsx
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
