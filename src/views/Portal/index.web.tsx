import { useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalProps } from "../../types";

export default function Portal({ hostName, children }: PortalProps) {
  const { getHost } = usePortalRegistryContext();
  const elRef = useRef<HTMLDivElement | null>(null);
  if (!elRef.current) {
    elRef.current = document.createElement("div");
  }

  const sentinelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;

    let target: Node | null = null;
    const hostNode = getHost(hostName);

    if (hostNode) {
      // Teleport: Append to host (use appendChild for end positioning; adjust if specific index needed)
      hostNode.appendChild(el);
      target = hostNode;
    } else if (sentinelRef.current && sentinelRef.current.parentNode) {
      // Local: Insert before sentinel to render at Portal's position in the tree
      sentinelRef.current.parentNode.insertBefore(el, sentinelRef.current);
      target = sentinelRef.current.parentNode;
    }

    return () => {
      // Cleanup: Remove el from current parent to avoid leaks/duplicates
      if (el.parentNode === target) {
        target.removeChild(el);
      }
    };
  }, [hostName, getHost]);

  return (
    <>
      {createPortal(children, elRef.current)}
      <div ref={sentinelRef} style={{ display: "contents" }} /> {/* Invisible sentinel for local position */}
    </>
  );
}
