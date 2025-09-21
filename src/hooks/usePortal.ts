import { usePortalManagerContext } from "../contexts/PortalManager";

/**
 * The `usePortal` hook allows you to manage portals in imperative way.
 *
 * @category Hooks
 * @param hostName - `name` of the `<PortalHost />` component
 * @returns an object that helps to manipulate portals
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
