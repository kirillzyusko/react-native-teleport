import { memo, useEffect } from "react";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalHostProps } from "../../types";

function PortalHost({ name, children, style }: PortalHostProps) {
  const { registerHost } = usePortalRegistryContext();

  useEffect(() => {
    return () => {
      registerHost(name, null);
    };
  }, [name, registerHost]);

  return (
    <div
      style={{ ...style, pointerEvents: "none" } as React.CSSProperties}
      ref={(ref) => registerHost(name, ref)}
    >
      {children}
    </div>
  );
}

export default memo(PortalHost);
