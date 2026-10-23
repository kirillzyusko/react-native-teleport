import type { CSSProperties } from "react";
import type {
  PortalHostProps as SharedPortalHostProps,
  PortalProps as SharedPortalProps,
} from "./shared";

export type { PortalProviderProps } from "./shared";
export type PortalHostProps = SharedPortalHostProps<CSSProperties>;
export type PortalProps = SharedPortalProps<CSSProperties>;
