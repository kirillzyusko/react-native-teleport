# Portal

The **Portal** API allows you to render a component in a different place in the view hierarchy. This is useful when you need a view to visually “break out” of its parent container (for example: modals, toasts, floating UI, popovers).

![Portal helps to render a new view in a different container](/react-native-teleport/pr-preview/pr-78/assets/images/portal-2b20b94e26669e61959d937697ed6dde.png)

Unlike simple `zIndex` tricks, Portals actually move the native view to another container, which guarantees correct behavior across different platforms, stacking contexts, and clipping boundaries.

## Why use Portal?[​](#why-use-portal "Direct link to Why use Portal?")

* Escape parent clipping: Portals are not limited by `overflow: hidden` or scroll containers.
* Native-level stacking: Works even where `zIndex` fails.
* Cross-platform: Consistent on iOS, Android and web.
* Dynamic UI: Great for modals, floating buttons, dropdowns, tooltips, and system-like overlays.

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

## Best practices[​](#best-practices "Direct link to Best practices")

* Always declare at least one `<PortalHost />` near your app root.
* Use host names if you need multiple layers (e.g., modal, toast, tooltip).

Teleportation

⚡ **Tip**: If you need to move an **existing** view (without unmounting/remounting), check out [Teleport](/react-native-teleport/pr-preview/pr-78/docs/guides/teleport.md) guide.
