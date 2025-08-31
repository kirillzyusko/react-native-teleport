import { createContext } from "react";
import PortalHostView from "./specs/PortalHostViewNativeComponent";

type PortalProviderProps = {
  children: React.ReactNode;
};
type PortalContextType = {};

const PortalContext = createContext<PortalContextType>({});

export default function PortalProvider({ children }: PortalProviderProps) {
  return (
    <PortalContext.Provider value={{}}>
      {children}
      <PortalHostView name="root" />
    </PortalContext.Provider>
  );
}
