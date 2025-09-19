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
    toast
  ]
---

# Portal

The **Portal** API allows you to render a component in a different place in the view hierarchy without unmounting it.
This is useful when you need a view to visually “break out” of its parent container (for example: modals, toasts, floating UI, popovers).

Unlike simple `zIndex` tricks, Portals actually move the native view to another container, which guarantees correct behavior across different platforms, stacking contexts, and clipping boundaries.

## Why use Portal?

- Escape parent clipping: Portals are not limited by `overflow: hidden` or scroll containers.
- Native-level stacking: Works even where `zIndex` fails.
- Cross-platform: Consistent on iOS, Android and web.
- Dynamic UI: Great for modals, floating buttons, dropdowns, tooltips, and system-like overlays.

// TODO: check example validity

## Example

```tsx
import { Portal, PortalHost } from "react-native-teleport";
import { View, Text, Button } from "react-native";

export default function App() {
  const [visible, setVisible] = React.useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Button title="Open modal" onPress={() => setVisible(true)} />

      {/* Place a PortalHost at the root of your app */}
      <PortalHost name="root" />

      {visible && (
        <Portal host="root">
          <View
            style={{
              position: "absolute",
              top: 100,
              left: 50,
              width: 200,
              height: 200,
              backgroundColor: "white",
              elevation: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text>Hello from Portal!</Text>
            <Button title="Close" onPress={() => setVisible(false)} />
          </View>
        </Portal>
      )}
    </View>
  );
}
```

## Best practices

- Always declare at least one `<PortalHost />` near your app root.
- Use host names if you need multiple layers (e.g., modal, toast, tooltip).

:::tip Teleportation
⚡ Tip: If you need to move an existing view (without unmounting/remounting), check out Teleport (Reparenting).
:::
