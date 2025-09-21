import { usePortalManagerContext } from "../contexts/PortalManager";

/**
 * The `usePortal` hook allows you to manage portals in imperative way.
 *
 * @category hooks
 * @param `hostName` - `name` of the `<PortalHost />` component
 * @returns an object that helps to manipulate portals
 * @example
 * ```tsx
 * import { usePortal } from "react-native-teleport";
 * export default function App() {
 *   const { removePortal } = usePortal("root");
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <Button title="Remove" onPress={() => removePortal("portal")} />
 *     </View>
 *   );
 * }
 * ```
 */
export default function usePortal(hostName: string = "root") {
  const { dispatch } = usePortalManagerContext();

  return {
    /**
     * Remove portal from host container. Subsequent re-renders will not resurrect portal,
     * but if you mount a new portal with the same name it will be shown (i. e. hook doesn't
     * prevent new portal from being added).
     *
     * @param name - `name` of `<Portal />` component.
     */
    removePortal: (name: string) =>
      dispatch({ type: "REMOVE_PORTAL", hostName, name }),
  };
}
