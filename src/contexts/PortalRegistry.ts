import { createContext, useContext } from "react";

type PortalRegistryContextType = {
  registerHost: (name: string, node: HTMLElement | null) => void;
  getHost: (name: string) => HTMLElement | null;
  registerPendingPortal: (name: string, callback: () => void) => void;
  unregisterPendingPortal: (name: string, callback: () => void) => void;
};

export const PortalRegistryContext =
  createContext<PortalRegistryContextType | null>(null);

export function usePortalRegistryContext() {
  const context = useContext(PortalRegistryContext);
  if (!context) {
    throw new Error(
      "usePortalRegistryContext must be used within a PortalRegistryContext",
    );
  }
  return context;
}
