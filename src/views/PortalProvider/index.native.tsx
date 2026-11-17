import type { PortalProviderProps } from "../../types";

/**
 * Native platforms don't need a registry, so this provider renders `children` as is.
 *
 * @param props - Provider props.
 * @param props.children - Your application tree.
 * @returns `children` without any wrappers.
 * @example
 * ```tsx
 * <PortalProvider>{children}</PortalProvider>
 * ```
 */
export default function PortalProvider({ children }: PortalProviderProps) {
  return children;
}
