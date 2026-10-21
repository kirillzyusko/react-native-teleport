import type { ComponentType } from "react";
import PortalComponent from "./components/Portal";
import PortalHostComponent from "./components/PortalHost";
import type { PortalHostProps, PortalProps } from "./types/index.native";

export { default as PortalProvider } from "./PortalProvider";
export { default as usePortal } from "./hooks/usePortal";

export const Portal = PortalComponent as ComponentType<PortalProps>;
export const PortalHost = PortalHostComponent as ComponentType<PortalHostProps>;
