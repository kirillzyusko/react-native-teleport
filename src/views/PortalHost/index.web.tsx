import { useEffect } from "react";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalHostProps } from "../../types";

function PortalHost({ name, children }: PortalHostProps) {
  const { setHost } = usePortalRegistryContext();

  useEffect(() => {
    return () => {
      setHost(name, null);
    };
  }, [name, setHost]);

  return <div ref={(ref) => setHost(name, ref)}>{children}</div>;
}

export default PortalHost;
