/// <reference lib="dom" />

import { useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalProps } from "../../types";

export default function Portal({ hostName, children, style }: PortalProps) {
  const { getHost } = usePortalRegistryContext();
  const elRef = useRef<HTMLDivElement | null>(null);
  if (!elRef.current) {
    elRef.current = document.createElement("div");
  }

  const sentinelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (elRef.current && style) {
      Object.assign(elRef.current.style, style);
    }
  }, [style]);

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;

    let target: Node | null = null;
    const hostNode = hostName ? getHost(hostName) : null;

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
        target?.removeChild(el);
      }
    };
  }, [hostName, getHost]);

  return (
    <>
      {elRef.current ? createPortal(children, elRef.current) : null}
      {/* Invisible sentinel for local position */}
      <div ref={sentinelRef} style={styles.anchor} />
    </>
  );
}

const styles = {
  anchor: {
    display: "contents",
  },
};
