import { usePortalManagerContext } from "../contexts/PortalManager";

export default function usePortal(hostName: string = "root") {
  const { dispatch } = usePortalManagerContext();

  return {
    removePortal: (name: string) =>
      dispatch({ type: "REMOVE_PORTAL", hostName, name }),
    restorePortal: (name: string) =>
      dispatch({ type: "RESTORE_PORTAL", hostName, name }),
  };
}
