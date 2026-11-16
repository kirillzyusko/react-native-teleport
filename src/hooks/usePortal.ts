import {
  useHostSnapshot,
  usePortalManagerContext,
} from "../contexts/PortalManager";

/**
 * The `usePortal` hook allows you to manage portals in imperative way.
 *
 * @param hostName - `name` of the `<PortalHost />` component.
 * @returns An object that helps to manipulate portals.
 * @category hooks
 * @example
 * ```tsx
 * import { usePortal } from "react-native-teleport";
 * export default function App() {
 *   const { removePortal, isHostAvailable } = usePortal("root");
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <Text>{isHostAvailable ? "Host is available" : "Host is not available"}</Text>
 *       <Button title="Remove" onPress={() => removePortal("portal")} />
 *     </View>
 *   );
 * }
 * ```
 */
export default function usePortal(hostName: string = "root") {
  const store = usePortalManagerContext();
  const isHostAvailable = useHostSnapshot(
    store,
    hostName,
    (host) => !!host?.mounts,
  );

  return {
    /**
     * Whether a `<PortalHost />` with the given `hostName` is currently mounted.
     */
    isHostAvailable,
    /**
     * Remove portal from host container. Subsequent re-renders will not restore portal,
     * but if you mount a new portal with the same name it will be shown (i. e. hook doesn't
     * prevent new portal from being added).
     *
     * @param name - `name` of `<Portal />` component.
     * @returns Nothing.
     */
    removePortal: (name: string) => store.removePortal(hostName, name),
  };
}
