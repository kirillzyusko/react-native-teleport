---
sidebar_position: 3
description: A component that moves its children to a different place in the view hierarchy.
keywords:
  [react-native-teleport, react-native teleport, react-native portal, portal]
---

# Portal

`Portal` is a component that moves its children to a different place in the native view hierarchy and preserves the react tree structure.

:::warning View layout
When a `Portal` is teleported to a new host, it automatically recalculates its layout using the host’s dimensions and **fills the entire available space by default**.

You **do not need to specify any layout styles** (such as `flex: 1`) for this to work - the size is set internally when the portal is attached to the new host.
:::

## Props

### `name`

The name of the portal. It's used to identify the portal in the context of the portal host.

### `hostName`

The `name` of the `PortalHost`. It's used to identify the host where the content should be rendered.

### `style`

The style of the portal. Accepts [ViewStyle](https://reactnative.dev/docs/view#style) props.

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
