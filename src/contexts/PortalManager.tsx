import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";

import { type PortalStore, createPortalStore } from "../state/portalStore";

const PortalManagerContext = createContext<PortalStore | undefined>(undefined);

export const PortalManagerProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [store] = useState(createPortalStore);

  return (
    <PortalManagerContext.Provider value={store}>
      {children}
    </PortalManagerContext.Provider>
  );
};

export const usePortalManagerContext = () => {
  const context = useContext(PortalManagerContext);

  if (!context) {
    throw new Error("usePortalContext must be used within PortalProvider");
  }

  return context;
};

/**
 * Subscribes to a single host in the portal store, so that changes of other hosts don't re-render the component.
 *
 * @param store - Portal store from `usePortalManagerContext`.
 * @param hostName - Name of the host to subscribe to.
 * @param select - Picks the value the component depends on from the host state.
 * @returns The selected value.
 * @example
 * ```ts
 * const mounted = useHostSnapshot(store, "overlay", (host) => !!host?.mounts);
 * ```
 */
export function useHostSnapshot<T>(
  store: PortalStore,
  hostName: string | undefined,
  select: (host: ReturnType<PortalStore["getHost"]>) => T,
) {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(hostName, listener),
    [store, hostName],
  );
  const getSnapshot = () => select(store.getHost(hostName));

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
