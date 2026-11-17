import PortalHost from "./components/PortalHost";
import { PortalManagerProvider } from "./contexts/PortalManager";
import NativePortalProvider from "./views/PortalProvider";

type PortalProviderProps = {
  children: React.ReactNode;
};

/**
 * Wraps your app with this component to use the teleport API.
 *
 * This component provides a context/registry for all Portals so that you can use imperative API, such as `usePortal` hook to manage Portals.
 *
 * @param props - Provider props.
 * @param props.children - Your application tree.
 * @returns A provider that wraps the app and mounts the default `root` host.
 * @category components
 * @example
 * ```tsx
 * import { PortalProvider } from "react-native-teleport";
 * export default function App() {
 *   return (
 *     <PortalProvider>
 *       //* your main application code goes here
 *     </PortalProvider>
 *   );
 * }
 */
export default function PortalProvider({ children }: PortalProviderProps) {
  return (
    <NativePortalProvider>
      <PortalManagerProvider>
        {children}
        <PortalHost name="root" style={styles.root} />
      </PortalManagerProvider>
    </NativePortalProvider>
  );
}

const styles = {
  root: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
} as const;
