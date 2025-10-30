/// <reference lib="dom" />

import { useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalProps } from "../../types";

export default function Portal({ hostName, children, style }: PortalProps) {
  const { getHost, registerPendingPortal, unregisterPendingPortal } =
    usePortalRegistryContext();
  const elRef = useRef<HTMLDivElement | null>(null);
  if (!elRef.current) {
    elRef.current = document.createElement("div");
  }

  const sentinelRef = useRef<HTMLDivElement>(null);
  const isWaitingForHostRef = useRef(false);

  useLayoutEffect(() => {
    if (elRef.current && style) {
      Object.assign(elRef.current.style, style);
    }
  }, [style]);

  const teleportToHost = useCallback(() => {
    const el = elRef.current;
    if (!el) return;

    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }

    const hostNode = hostName ? getHost(hostName) : null;

    if (hostNode) {
      // teleport view to the host
      hostNode.appendChild(el);
      isWaitingForHostRef.current = false;
    } else if (sentinelRef.current && sentinelRef.current.parentNode) {
      // keep view locally
      sentinelRef.current.parentNode.insertBefore(el, sentinelRef.current);
    }
  }, [hostName, getHost]);

  useLayoutEffect(() => {
    const hostNode = hostName ? getHost(hostName) : null;

    if (isWaitingForHostRef.current && hostName) {
      unregisterPendingPortal(hostName, teleportToHost);
      isWaitingForHostRef.current = false;
    }

    teleportToHost();

    if (hostName && !hostNode) {
      registerPendingPortal(hostName, teleportToHost);
      isWaitingForHostRef.current = true;
    }

    return () => {
      if (isWaitingForHostRef.current && hostName) {
        unregisterPendingPortal(hostName, teleportToHost);
        isWaitingForHostRef.current = false;
      }
    };
  }, [
    hostName,
    getHost,
    registerPendingPortal,
    unregisterPendingPortal,
    teleportToHost,
  ]);

  return (
    <>
      {createPortal(children, elRef.current)}
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
