import type { PortalHostProps } from "../types";
import PortalHost from "../views/PortalHost";

/**
 * PortalHost is a component that acts as an anchor for the portals.
 * You can define multiple portal hosts in your app and use them to render different portals.
 * Each portal host has a unique name that you can use to identify a necessary one among the others.
 *
 * @category components
 * @param name - The name of the portal host. It's used by `<Portal />` component to identify the host.
 *
 * @example
 * ```tsx
 * import { StyleSheet, View } from "react-native";
 * import { PortalHost, PortalProvider } from "react-native-teleport";
 * export default function App() {
 *   return (
 *     <PortalProvider>
 *       <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
 *         <PortalHost name="overlay" />
 *       </View>
 *     </PortalProvider>
 *   );
 * }
 * ```
 */
const PortalHostComponent = ({ name, children, style }: PortalHostProps) => {
  return (
    <PortalHost name={name} style={style} pointerEvents="box-none">
      {children}
    </PortalHost>
  );
};

export default PortalHostComponent;
