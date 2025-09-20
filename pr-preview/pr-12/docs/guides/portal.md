# Portal

The **Portal** API allows you to render a component in a different place in the view hierarchy. This is useful when you need a view to visually “break out” of its parent container (for example: modals, toasts, floating UI, popovers).

![Portal helps to render a new view in a different container](/react-native-teleport/pr-preview/pr-12/assets/images/portal-2b20b94e26669e61959d937697ed6dde.png)

Unlike simple `zIndex` tricks, Portals actually move the native view to another container, which guarantees correct behavior across different platforms, stacking contexts, and clipping boundaries.

## Why use Portal?[​](#why-use-portal "Direct link to Why use Portal?")

* Escape parent clipping: Portals are not limited by `overflow: hidden` or scroll containers.
* Native-level stacking: Works even where `zIndex` fails.
* Cross-platform: Consistent on iOS, Android and web.
* Dynamic UI: Great for modals, floating buttons, dropdowns, tooltips, and system-like overlays.

// TODO: check example validity

## Example[​](#example "Direct link to Example")

```
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

## Best practices[​](#best-practices "Direct link to Best practices")

* Always declare at least one `<PortalHost />` near your app root.
* Use host names if you need multiple layers (e.g., modal, toast, tooltip).

Teleportation

⚡ **Tip**: If you need to move an **existing** view (without unmounting/remounting), check out [Teleport](/react-native-teleport/pr-preview/pr-12/docs/guides/teleport.md) guide.
