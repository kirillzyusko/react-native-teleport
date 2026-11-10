import { memo, useCallback, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { StyleSheet } from "react-native";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalHostProps } from "../../types";

function PortalHost({ name, children, style, fullScreen }: PortalHostProps) {
  const { registerHost } = usePortalRegistryContext();
  // A fresh callback ref would unregister/register the same host on every
  // render, temporarily sending all its Portals back to their source trees.
  const hostRef = useCallback(
    (node: HTMLDivElement | null) => registerHost(name, node),
    [name, registerHost],
  );

  useEffect(() => {
    return () => {
      registerHost(name, null);
    };
  }, [name, registerHost]);

  const host = (
    <div
      style={
        {
          // Portals use absolute host-sized groups. Establish the host's own
          // containing block so they cannot anchor to an outer screen instead.
          position: "relative",
          ...StyleSheet.flatten(style),
          ...(fullScreen
            ? {
                position: "fixed",
                inset: 0,
                width: "auto",
                height: "auto",
                zIndex: 1,
              }
            : undefined),
          pointerEvents: "none",
        } as CSSProperties
      }
      ref={hostRef}
    >
      {children}
    </div>
  );
  // Escape ancestor clipping/transforms while preserving React context. This
  // ordinary document layer deliberately stays below react-native-web's Modal.
  return fullScreen ? createPortal(host, document.body) : host;
}

export default memo(PortalHost);
