import { useEffect } from "react";
import { usePortalManagerContext } from "../contexts/PortalManager";
import PortalView from "../views/Portal";
import useId from "../hooks/useId";
import type { PortalProps } from "../types";

/**
 * Portal helps you to render a component in a different place in the view hierarchy.
 * This is useful when you need a view to visually “break out” of its parent container (for example: modals, toasts, floating UI, popovers).
 *
 * @category components
 * @param hostName - The name of the portal host. It's used to identify the host where the content should be rendered.
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
  const { state, dispatch } = usePortalManagerContext();
  const instanceId = useId();

  const isRemoved =
    hostName && name ? state.removed[hostName]?.[name]?.[instanceId] : false;

  useEffect(() => {
    if (!hostName || !name) {
      return;
    }

    dispatch({ type: "REGISTER_PORTAL", hostName, name, instanceId });

    return () => {
      dispatch({
        type: "CLEAR_REMOVED_ON_UNMOUNT",
        hostName,
        name,
        instanceId,
      });
    };
  }, [dispatch, hostName, name, instanceId]);

  if (isRemoved) {
    return <PortalView hostName={hostName} name={name} />;
  }

  return (
    <PortalView hostName={hostName} name={name} style={style}>
      {children}
    </PortalView>
  );
};

export default PortalComponent;
