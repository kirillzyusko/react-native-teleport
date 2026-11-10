import { memo, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { StyleSheet } from "react-native";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalHostProps } from "../../types";

function PortalHost({ name, children, style, fullScreen }: PortalHostProps) {
  const { registerHost } = usePortalRegistryContext();

  useEffect(() => {
    return () => {
      registerHost(name, null);
    };
  }, [name, registerHost]);

  const host = (
    <div
      style={
        {
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
      ref={(ref) => registerHost(name, ref)}
    >
      {children}
    </div>
  );
  return fullScreen ? createPortal(host, document.body) : host;
}

export default memo(PortalHost);
