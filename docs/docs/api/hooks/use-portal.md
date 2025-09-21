---
sidebar_position: 1
description: Hook that allows to manage portals.
keywords:
  [
    react-native-teleport,
    react-native teleport,
    react-native portal,
    usePortal,
    removePortal,
    remove portal,
  ]
---

# usePortal

The `usePortal` hook allows you to manage portals in imperative way.

## Example

```tsx
import { usePortal } from "react-native-teleport";

export default function App() {
  const { removePortal } = usePortal("root");

  return (
    <View style={{ flex: 1 }}>
      <Button title="Remove" onPress={() => removePortal("portal")} />
    </View>
  );
}
```

## Declaration

```ts
/**
 * @param hostName - `name` of the `<PortalHost />` component
 */
type usePortal = (hostName: string = 'root') => {
  /**
   * Remove portal from host container. Subsequent re-renders will not resurrect portal,
   * but if you mount a new portal with the same name it will be shown (i. e. hook doesn't
   * prevent new portal from being added).
   * @param name - `name` of `<Portal />` component.
   */
  removePortal: (name: string) => void;
};
```
