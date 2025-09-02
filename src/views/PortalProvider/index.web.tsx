import { useCallback, useMemo, useRef } from "react";
import { PortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalProviderProps } from "../../types";

export default function PortalProvider({ children }: PortalProviderProps) {
  const hostsRef = useRef<Map<string, HTMLElement>>(new Map());

  const setHost = useCallback((name: string, node: HTMLElement | null) => {
    if (node) {
      hostsRef.current.set(name, node);
    } else {
      hostsRef.current.delete(name);
    }
  }, []);
  const getHost = useCallback(
    (name: string) => hostsRef.current.get(name) ?? null,
    [],
  );

  const value = useMemo(() => ({ setHost, getHost }), [setHost, getHost]);

  return (
    <PortalRegistryContext.Provider value={value}>
      {children}
    </PortalRegistryContext.Provider>
  );
}
