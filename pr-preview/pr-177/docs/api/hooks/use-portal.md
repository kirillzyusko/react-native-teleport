# usePortal

The `usePortal` hook allows you to manage portals in imperative way.

## Example[​](#example "Direct link to Example")

```
import { usePortal } from "react-native-teleport";

export default function App() {
  const { removePortal, isHostAvailable } = usePortal("root");

  return (
    <View style={{ flex: 1 }}>
      <Text>{isHostAvailable ? "Host is available" : "Host is not available"}</Text>
      <Button title="Remove" onPress={() => removePortal("portal")} />
    </View>
  );
}
```

## Declaration[​](#declaration "Direct link to Declaration")

```
/**
 * @param hostName - `name` of the `<PortalHost />` component
 */
type usePortal = (hostName: string = "root") => {
  /**
   * Whether a `<PortalHost />` with the given `hostName` is currently mounted.
   */
  isHostAvailable: boolean;
  /**
   * Remove portal from host container. Subsequent re-renders will not restore portal,
   * but if you mount a new portal with the same name it will be shown (i. e. hook doesn't
   * prevent new portal from being added).
   * @param name - `name` of `<Portal />` component.
   */
  removePortal: (name: string) => void;
};
```
