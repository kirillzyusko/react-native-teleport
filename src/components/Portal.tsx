import { useContext, useEffect } from "react";
import {
  useHostSnapshot,
  usePortalManagerContext,
} from "../contexts/PortalManager";
import ScrollViewContext from "../contexts/ScrollViewContext";
import PortalView from "../views/Portal";
import useId from "../hooks/useId";
import type { PortalProps } from "../types";

/**
 * Portal helps you to render a component in a different place in the view hierarchy.
 * This is useful when you need a view to visually “break out” of its parent container (for example: modals, toasts, floating UI, popovers).
 *
 * @category components
 * @param hostName - The `name` of the `PortalHost`. It's used to identify the host where the content should be rendered.
 * @param name - The name of the portal. It's used to identify the portal.
 * @param children - The content that should be rendered in the portal.
 * @example
 * ```tsx
 * import { useState } from "react";
 * import { View, StyleSheet, Button } from "react-native";
 * import { Portal } from "react-native-teleport";
 * export default function InstantRootExample() {
 *   const [shouldBeTeleported, setTeleported] = useState(true);
 *   return (
 *     <View style={styles.container}>
 *       {shouldBeTeleported && (
 *         <Portal hostName={"overlay"}>
 *           <View style={styles.box} />
 *         </Portal>
 *       )}
 *       <Button
 *         title={shouldBeTeleported ? "Hide" : "Show"}
 *         onPress={() => setTeleported((t) => !t)}
 *       />
 *     </View>
 *   );
 * }
 * const styles = StyleSheet.create({
 *   container: {
 *     flex: 1,
 *     alignItems: "center",
 *     justifyContent: "center",
 *   },
 *   box: {
 *     width: 160,
 *     height: 160,
 *     marginVertical: 20,
 *     backgroundColor: "blue",
 *   },
 * });
 * ```
 */
const PortalComponent = ({ hostName, name, style, children }: PortalProps) => {
  const sourceScrollViewContext = useContext(ScrollViewContext);
  const store = usePortalManagerContext();
  const instanceId = useId();
  const target = hostName || undefined;
  const scrollViewContext = useHostSnapshot(store, target, (host) =>
    host?.mounts ? host.scrollContext : sourceScrollViewContext,
  );
  const isRemoved = useHostSnapshot(
    store,
    name ? target : undefined,
    (host) => !!(name && host?.portals.get(name)?.get(instanceId)),
  );

  useEffect(() => {
    if (!hostName || !name) {
      return;
    }

    return store.registerPortal(hostName, name, instanceId);
  }, [store, hostName, name, instanceId]);

  return (
    <ScrollViewContext.Provider value={scrollViewContext}>
      <PortalView hostName={hostName} name={name} style={style}>
        {isRemoved ? null : children}
      </PortalView>
    </ScrollViewContext.Provider>
  );
};

export default PortalComponent;
