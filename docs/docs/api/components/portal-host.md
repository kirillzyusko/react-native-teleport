---
sidebar_position: 2
description: A component that acts as an anchor for the portals.
keywords:
  [
    react-native-teleport,
    react-native teleport,
    react-native portal,
    PortalHost,
  ]
---

# PortalHost

`PortalHost` is a component that acts as an anchor for the portals. You can define multiple portal hosts in your app and use them to render different portals. Each portal host has a unique name that you can use to identify a necessary one among the others.

:::warning View dimensions
`PortalHost` is just another view, so make sure that you set the correct dimensions for it. Otherwise, the portal _**may**_ not be rendered correctly, especially if `Portal` relies on a flex layout and host has zero (i. e. `0x0`) dimensions.
:::

## Props

### `name`

The name of the portal host. It's used to identify the host by `<Portal />` component.

### `style`

The style of the portal host. Accepts [ViewStyle](https://reactnative.dev/docs/view#style) props.

### `fullScreen`

Optional boolean, defaults to `false`. Places the host's content above navigation
in the current React surface and sizes it to that surface, including the native
navigation header. Mount one persistent host near the app root, outside the
navigator. Its Fabric anchor stays at its original location; only the physical
destination moves. An empty host lets touches through.

This uses an ordinary native view, not a new window, dialog, or modal
presentation. Native modals and system UI remain above it. It does not change
status-bar appearance, cover the keyboard, or request Android overlay permissions.
On web the destination is a fixed-position element in `document.body`.

Native gesture-handler ancestry changes when content moves to the surface root.
If your dialog uses `react-native-gesture-handler`, provide a
`GestureHandlerRootView` inside the portaled content as needed, especially on
Android.

```tsx
<PortalProvider>
  <NavigationContainer>{/* navigation */}</NavigationContainer>
  <PortalHost name="dialogs" fullScreen />
</PortalProvider>
```

Several Portals can target this host. See [Portal stacking](./portal#stacking)
for default ordering and manual priority.

## Example

```tsx
import { StyleSheet, View } from "react-native";
import { PortalHost, PortalProvider } from "react-native-teleport";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import RootStack from "./navigation";

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PortalProvider>
        <RootStack />
        <PortalHost style={StyleSheet.absoluteFill} name="overlay" />
      </PortalProvider>
    </SafeAreaProvider>
  );
}
```
