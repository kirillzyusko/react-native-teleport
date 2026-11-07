# PortalHost

`PortalHost` is a component that acts as an anchor for the portals. You can define multiple portal hosts in your app and use them to render different portals. Each portal host has a unique name that you can use to identify a necessary one among the others.

View dimensions

`PortalHost` is just another view, so make sure that you set the correct dimensions for it. Otherwise, the portal ***may*** not be rendered correctly, especially if `Portal` relies on a flex layout and host has zero (i. e. `0x0`) dimensions.

## Props[​](#props "Direct link to Props")

### `name`[​](#name "Direct link to name")

The name of the portal host. It's used to identify the host by `<Portal />` component.

### `style`[​](#style "Direct link to style")

The style of the portal host. Accepts [ViewStyle](https://reactnative.dev/docs/view#style) props.

`StyleSheet.absoluteFill` can be passed directly to `style` on React Native 0.81. When spreading it into a style object, use `...StyleSheet.flatten(StyleSheet.absoluteFill)` for compatibility with the older TypeScript declarations. [React Native 0.82 corrected its type](https://github.com/react/react-native/pull/53530) from a registered style ID to an object, so a direct spread is supported there and in later versions.

## Example[​](#example "Direct link to Example")

```
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
