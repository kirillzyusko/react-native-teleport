/// <reference lib="dom" />

import { useCallback, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { usePortalRegistryContext } from "../../contexts/PortalRegistry";

import type { PortalProps } from "../../types";

const supportsMoveBefore =
  typeof Element !== "undefined" && "moveBefore" in Element.prototype;

/**
 * Moves `child` into `parent`, keeping the DOM node state when `moveBefore` is supported.
 *
 * @param parent - The new parent element.
 * @param child - The element to move.
 * @param before - The element to insert `child` before. Appends to the end when `null`.
 * @example
 * ```ts
 * moveElementTo(hostNode, portalNode);
 * ```
 */
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

/**
 * Web implementation of the portal: renders `children` into a detached element and moves it into the host.
 *
 * @param props - Portal props.
 * @param props.hostName - The `name` of the host where the content should be rendered.
 * @param props.children - The content that should be rendered in the portal.
 * @param props.style - Style of the portal container.
 * @returns A React portal and an invisible sentinel that marks the local position.
 * @example
 * ```tsx
 * <Portal hostName="overlay">
 *   <View />
 * </Portal>
 * ```
 */
export default function Portal({ hostName, children, style }: PortalProps) {
  const { getHost, registerPendingPortal, unregisterPendingPortal } =
    usePortalRegistryContext();
  const elRef = useRef<HTMLDivElement | null>(null);

  if (elRef.current === null) {
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

    if (!el) {
      return;
    }

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

    if (!hostName) {
      return;
    }

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

  useLayoutEffect(() => {
    return () => {
      const el = elRef.current;

      if (el?.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  return (
    <>
      {/* eslint-disable-next-line react-hooks/refs -- the container is created once and never replaced */}
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
