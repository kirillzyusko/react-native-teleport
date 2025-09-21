---
sidebar_position: 1
description: A component that should wrap your app.
keywords:
  [
    react-native-teleport,
    react-native teleport,
    react-native portal,
    PortalProvider,
  ]
---

# PortalProvider

Wrap your app with this component to use the portal API.

This component provides a context/registry for all Portals so that you can use imperative API, such as `usePortal` hook to manage Portals.

## Example

```tsx
import { PortalProvider } from "react-native-teleport";

export default function App() {
  return (
    <PortalProvider>
      {/* your main application code goes here */}
    </PortalProvider>
  );
}
```
