import { createContext } from "react";
import PortalHost from "./views/PortalHost";
import NativePortalProvider from "./views/PortalProvider";

type PortalProviderProps = {
  children: React.ReactNode;
};
type PortalContextType = {};

const PortalContext = createContext<PortalContextType>({});

export default function PortalProvider({ children }: PortalProviderProps) {
  return (
    <NativePortalProvider>
      <PortalContext.Provider value={{}}>
        {children}
        <PortalHost name="root" />
      </PortalContext.Provider>
    </NativePortalProvider>
  );
}
