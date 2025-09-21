---
sidebar_position: 2
description: Portal helps you to render a component in a different place in the view hierarchy.
keywords:
  [
    react-native-teleport,
    react-native teleport,
    react-native portal,
    teleport,
    portal,
    modal,
    popover,
    tooltip,
    alert,
    toast,
  ]
---

# Portal

The **Portal** API allows you to render a component in a different place in the view hierarchy.
This is useful when you need a view to visually “break out” of its parent container (for example: modals, toasts, floating UI, popovers).

<div className="lottie">
  <img src={require("@site/static/img/gifs/portal.png").default} alt="Portal helps to render a new view in a different container" />
</div>

Unlike simple `zIndex` tricks, Portals actually move the native view to another container, which guarantees correct behavior across different platforms, stacking contexts, and clipping boundaries.

## Why use Portal?

- Escape parent clipping: Portals are not limited by `overflow: hidden` or scroll containers.
- Native-level stacking: Works even where `zIndex` fails.
- Cross-platform: Consistent on iOS, Android and web.
- Dynamic UI: Great for modals, floating buttons, dropdowns, tooltips, and system-like overlays.

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

## Best practices

- Always declare at least one `<PortalHost />` near your app root.
- Use host names if you need multiple layers (e.g., modal, toast, tooltip).

:::tip Teleportation
⚡ **Tip**: If you need to move an **existing** view (without unmounting/remounting), check out [Teleport](./teleport) guide.
:::
