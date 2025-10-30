import { memo, useEffect } from "react";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalHostProps } from "../../types";

function PortalHost({ name, children }: PortalHostProps) {
  const { registerHost } = usePortalRegistryContext();

  useEffect(() => {
    return () => {
      registerHost(name, null);
    };
  }, [name, registerHost]);

  return (
    <div style={styles.anchor} ref={(ref) => registerHost(name, ref)}>
      {children}
    </div>
  );
}

const styles = {
  anchor: {
    display: "contents",
  },
};

export default memo(PortalHost);
