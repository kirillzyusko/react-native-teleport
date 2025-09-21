# PortalHost

`PortalHost` is a component that acts as an anchor for the portals. You can define multiple portal hosts in your app and use them to render different portals. Each portal host has a unique name that you can use to identify a necessary one among the others.

## Props[​](#props "Direct link to Props")

### `name`[​](#name "Direct link to name")

The name of the portal host. It's used to identify the host by `<Portal />` component.

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
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <PortalHost name="overlay" />
        </View>
      </PortalProvider>
    </SafeAreaProvider>
  );
}
```
