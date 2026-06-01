/// <reference lib="dom" />

import { useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalProps } from "../../types";

const supportsMoveBefore =
  typeof Element !== "undefined" && "moveBefore" in Element.prototype;

function moveElementTo(
  parent: Element,
  child: Element,
  before: Element | null = null,
) {
  if (supportsMoveBefore && child.parentNode) {
    parent.moveBefore(child, before);
    return;
  }

  if (child.parentNode) {
    child.parentNode.removeChild(child);
  }

  parent.insertBefore(child, before);
}

export default function Portal({ hostName, children, style }: PortalProps) {
  const { getHost, registerPendingPortal, unregisterPendingPortal } =
    usePortalRegistryContext();
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

  const teleportToHost = useCallback(() => {
    const el = elRef.current;
    if (!el) return;

    const hostNode = hostName ? getHost(hostName) : null;
    if (hostNode) {
      // teleport view to the host
      moveElementTo(hostNode, el);
    } else if (sentinelRef.current && sentinelRef.current.parentElement) {
      // keep view locally
      const parent = sentinelRef.current.parentElement;
      moveElementTo(parent, el, sentinelRef.current);
    }
  }, [hostName, getHost]);

  useLayoutEffect(() => {
    teleportToHost();

    if (!hostName) return;

    registerPendingPortal(hostName, teleportToHost);
    return () => {
      unregisterPendingPortal(hostName, teleportToHost);
    };
  }, [
    hostName,
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
