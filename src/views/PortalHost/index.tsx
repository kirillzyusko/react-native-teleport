import { type CSSProperties, memo, useEffect } from "react";

import { usePortalRegistryContext } from "../../contexts/PortalRegistry";

import type { PortalHostProps } from "../../types";

/**
 * Web implementation of the portal host: registers its DOM node in the portal registry.
 *
 * @param props - Portal host props.
 * @param props.name - The name of the portal host.
 * @param props.children - Content rendered inside the host.
 * @param props.style - Style of the host container.
 * @returns A `div` that acts as a target for portals.
 * @example
 * ```tsx
 * <PortalHost name="overlay" />
 * ```
 */
function PortalHost({ name, children, style }: PortalHostProps) {
  const { registerHost } = usePortalRegistryContext();

  useEffect(() => {
    return () => {
      registerHost(name, null);
    };
  }, [name, registerHost]);

  return (
    <div
      ref={(ref) => registerHost(name, ref)}
      style={{ ...style, pointerEvents: "none" } as CSSProperties}
    >
      {children}
    </div>
  );
}

export default memo(PortalHost);
