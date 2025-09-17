import PortalHost from "./views/PortalHost";
import NativePortalProvider from "./views/PortalProvider";
import { PortalManagerProvider } from "./contexts/PortalManager";

type PortalProviderProps = {
  children: React.ReactNode;
};

export default function PortalProvider({ children }: PortalProviderProps) {
  return (
    <NativePortalProvider>
      <PortalManagerProvider>
        {children}
        <PortalHost name="root" />
      </PortalManagerProvider>
    </NativePortalProvider>
  );
}
