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
        <PortalHost style={StyleSheet.absoluteFillObject} name="overlay" />
      </PortalProvider>
    </SafeAreaProvider>
  );
}
```
