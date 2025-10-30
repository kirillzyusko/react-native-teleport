import { useCallback, useMemo, useRef } from "react";
import { PortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalProviderProps } from "../../types";

export default function PortalProvider({ children }: PortalProviderProps) {
  const hostsRef = useRef<Map<string, HTMLElement>>(new Map());
  const pendingPortalsRef = useRef<Map<string, Set<() => void>>>(new Map());

  const registerHost = useCallback((name: string, node: HTMLElement | null) => {
    if (node) {
      hostsRef.current.set(name, node);

      const callbacks = pendingPortalsRef.current.get(name);
      if (callbacks) {
        callbacks.forEach((callback) => callback());
        pendingPortalsRef.current.delete(name);
      }
    } else {
      hostsRef.current.delete(name);
    }
  }, []);
  const getHost = useCallback(
    (name: string) => hostsRef.current.get(name) ?? null,
    [],
  );
  const registerPendingPortal = useCallback(
    (name: string, callback: () => void) => {
      const callbacks = pendingPortalsRef.current.get(name) ?? new Set();
      callbacks.add(callback);
      pendingPortalsRef.current.set(name, callbacks);
    },
    [],
  );
  const unregisterPendingPortal = useCallback(
    (name: string, callback: () => void) => {
      const callbacks = pendingPortalsRef.current.get(name);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          pendingPortalsRef.current.delete(name);
        }
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      registerHost,
      getHost,
      registerPendingPortal,
      unregisterPendingPortal,
    }),
    [registerHost, getHost, registerPendingPortal, unregisterPendingPortal],
  );

  return (
    <PortalRegistryContext.Provider value={value}>
      {children}
    </PortalRegistryContext.Provider>
  );
}
