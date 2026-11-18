# PortalProvider

Wrap your app with this component to use the portal API.

This component provides a context/registry for all Portals so that you can use imperative API, such as `usePortal` hook to manage Portals.

## Example[​](#example "Direct link to Example")

```
import { PortalProvider } from "react-native-teleport";

export default function App() {
  return (
    <PortalProvider>
      {/* your main application code goes here */}
    </PortalProvider>
  );
}
```
