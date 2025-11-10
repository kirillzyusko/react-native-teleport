import TeleportModule from "./modules/teleport";

TeleportModule?.install();

export { default as PortalHost } from "./components/PortalHost";
export { default as Portal } from "./components/Portal";
export { default as PortalProvider } from "./PortalProvider";
export { default as usePortal } from "./hooks/usePortal";
