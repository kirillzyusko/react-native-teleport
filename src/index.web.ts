import type { ComponentType, CSSProperties } from "react";
import PortalComponent from "./components/Portal";
import PortalHostComponent from "./components/PortalHost";
import type { PortalHostProps, PortalProps } from "./types/shared";

export { default as PortalProvider } from "./PortalProvider";
export { default as usePortal } from "./hooks/usePortal";

export const Portal = PortalComponent as ComponentType<
  PortalProps<CSSProperties>
>;
export const PortalHost = PortalHostComponent as ComponentType<
  PortalHostProps<CSSProperties>
>;
