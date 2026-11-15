import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { createPortalStore, type PortalStore } from "../state/portalStore";

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
