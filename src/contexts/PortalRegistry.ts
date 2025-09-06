import { createContext, useContext } from "react";

type PortalRegistryContextType = {
  setHost: (name: string, node: HTMLElement | null) => void;
  getHost: (name: string) => HTMLElement | null;
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
