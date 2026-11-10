/// <reference lib="dom" />

import { useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { StyleSheet, View } from "react-native";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { PortalProps } from "../../types";

const supportsMoveBefore =
  typeof Element !== "undefined" && "moveBefore" in Element.prototype;

function moveElementTo(
  parent: Element,
  child: Element,
  before: Element | null = null,
) {
  // Re-inserting an already-positioned node can blur focused inputs or restart
  // media in browsers without moveBefore(). Leave unchanged positions alone.
  if (child.parentNode === parent && child.nextSibling === before) return;

  if (supportsMoveBefore && child.parentNode) {
    parent.moveBefore(child, before);
    return;
  }

  if (child.parentNode) {
    child.parentNode.removeChild(child);
  }

  parent.insertBefore(child, before);
}

export default function Portal({
  hostName,
  children,
  style,
  stackOrder,
  mountOrder = 0,
}: PortalProps & { mountOrder?: number }) {
  const { getHost, registerPendingPortal, unregisterPendingPortal } =
    usePortalRegistryContext();
  const elRef = useRef<HTMLDivElement | null>(null);
  if (!elRef.current) {
    elRef.current = document.createElement("div");
    // The group fills its host for layout, but only its actual content should
    // intercept input. The box-none View below re-enables events for children.
    elRef.current.style.pointerEvents = "none";
  }

  const sentinelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (elRef.current && style) {
      Object.assign(elRef.current.style, StyleSheet.flatten(style));
    }
  }, [style]);

  const teleportToHost = useCallback(() => {
    const el = elRef.current;
    if (!el) return;

    const hostNode = hostName ? getHost(hostName) : null;
    if (hostNode) {
      // Match the native stack container's host-sized layout. Each Portal is a
      // separate CSS stacking context, keeping its backdrop and content together.
      Object.assign(el.style, {
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        inset: "0",
        zIndex: String(stackOrder ?? 0),
      });
      el.dataset.teleportOrder = String(mountOrder);
      el.dataset.teleportPriority = String(stackOrder ?? 0);
      if (el.parentNode !== hostNode) moveElementTo(hostNode, el);
      const portals = Array.from(hostNode.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement &&
          child.dataset.teleportOrder !== undefined,
      );
      portals.sort(
        (a, b) =>
          Number(a.dataset.teleportPriority) -
            Number(b.dataset.teleportPriority) ||
          Number(a.dataset.teleportOrder) - Number(b.dataset.teleportOrder),
      );
      // Reconcile the ordered suffix backwards. Stable groups are never moved,
      // and non-Portal children keep their relative order below that suffix.
      let next: Element | null = null;
      for (const portal of portals.reverse()) {
        moveElementTo(hostNode, portal, next);
        next = portal;
      }
    } else if (sentinelRef.current && sentinelRef.current.parentElement) {
      // Drop host-only geometry on fallback; otherwise a detached/missing host
      // can leave the local content positioned against the wrong ancestor.
      const parent = sentinelRef.current.parentElement;
      Object.assign(
        el.style,
        { position: "", inset: "", zIndex: "", display: "", flexDirection: "" },
        StyleSheet.flatten(style),
      );
      delete el.dataset.teleportOrder;
      delete el.dataset.teleportPriority;
      moveElementTo(parent, el, sentinelRef.current);
    }
  }, [hostName, getHost, stackOrder, mountOrder, style]);

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
      {createPortal(
        <View pointerEvents="box-none" style={styles.content}>
          {children}
        </View>,
        elRef.current,
      )}
      {/* Invisible sentinel for local position */}
      <div ref={sentinelRef} style={styles.anchor} />
    </>
  );
}

const styles = {
  content: { flex: 1 },
  anchor: {
    display: "contents",
  },
};
