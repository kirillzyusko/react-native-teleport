# Lifecycle & behavior

This page describes the contract between [`Portal`](/react-native-teleport/pr-preview/pr-124/docs/api/components/portal.md) and [`PortalHost`](/react-native-teleport/pr-preview/pr-124/docs/api/components/portal-host.md) - what renders where, and how children move as components mount and unmount.

The rules are designed to match what you'd intuitively expect from a portal system: children always end up *somewhere* visible, and they survive transient changes to the host.

## 1. Static behavior[​](#1-static-behavior "Direct link to 1. Static behavior")

Given a fixed configuration that doesn't change over time, this is where children render.

| `Portal` configuration                                | Result                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| No `hostName` prop                                    | Children render **locally**, in place. `Portal` behaves like a transparent wrapper.         |
| `hostName="x"` and a `<PortalHost name="x" />` exists | Children are **teleported** into that host.                                                 |
| `hostName="x"` but no host with that name exists      | Children render **locally** as a fallback. As soon as a matching host mounts, they migrate. |

The "render locally as fallback" rule means a `Portal` is never a black hole - children are always attached to a live view tree, even if the host is missing.

Conditionally rendering when no host exists

If you'd rather render *nothing* (or a different UI) while the host is missing instead of falling back locally, use the [`usePortal`](/react-native-teleport/pr-preview/pr-124/docs/api/hooks/use-portal.md) hook and read its `isHostAvailable` flag:

```
import { Portal, usePortal } from "react-native-teleport";

function Toast() {
  const { isHostAvailable } = usePortal("toast");
  if (!isHostAvailable) return null;

  return (
    <Portal hostName="toast">
      <ToastContent />
    </Portal>
  );
}
```

This way the `<ToastContent />` tree is only mounted while the host exists, instead of rendering at the local position and migrating later.

## 2. Dynamic behavior[​](#2-dynamic-behavior "Direct link to 2. Dynamic behavior")

The interesting cases happen when something changes. The library guarantees the following transitions:

### A host mounts after the Portal[​](#a-host-mounts-after-the-portal "Direct link to A host mounts after the Portal")

Children that were rendering locally as a fallback are moved into the new host automatically. The React tree doesn't re-render - only the native views are re-parented.

### A host unmounts while the Portal is still alive[​](#a-host-unmounts-while-the-portal-is-still-alive "Direct link to A host unmounts while the Portal is still alive")

Children are pulled back to the Portal's local position so they remain attached to a live view tree. They are *not* destroyed. Component state, refs, and any imperative native state (animation values, video playback position, scroll offset, etc.) are preserved.

### A host remounts (mount → unmount → mount)[​](#a-host-remounts-mount--unmount--mount "Direct link to A host remounts (mount → unmount → mount)")

On each cycle, children follow the host. Mounting a host with the same name a second time picks up exactly where the first cycle left off - there's no special "first mount" logic. This is the foundation for `PersistedPortal`-style patterns where a Portal outlives its host(s).

### Portal's `hostName` prop changes[​](#portals-hostname-prop-changes "Direct link to portals-hostname-prop-changes")

Children migrate from the previous target (host or local) to the new target. If the new `hostName` has no matching host, children fall back to local rendering until that host appears.

### Portal unmounts[​](#portal-unmounts "Direct link to Portal unmounts")

Its children unmount with it, regardless of where they currently live. The host doesn't keep orphaned children - `Portal` owns its children's React lifecycle, the host only owns their physical attachment point.

### Host unmounts[​](#host-unmounts "Direct link to Host unmounts")

Only the host disappears. All Portals targeting it survive, with their children intact (rendering locally per the rule above).

## 3. Identity and ordering[​](#3-identity-and-ordering "Direct link to 3. Identity and ordering")

These are the rules that are easy to get wrong if you don't know them.

* **Multiple Portals targeting the same host** are appended in React mount order. If `Portal A` mounts before `Portal B`, `A`'s children appear above `B`'s in the host. Reordering the Portals in the React tree reorders them in the host.
* **Host names are matched as strings.** Two `PortalHost` instances with the same `name` mounted at the same time is undefined behavior - only the most recently registered one will receive new portals. Unmounting either may leave children stranded. Use unique names per active host.
* **React identity is preserved across host mount/unmount cycles.** A teleported `<Video />` does not reset its playback position when its host unmounts and remounts. This is the whole reason you'd reach for a Portal that outlives its host.

## 4. What Portal does NOT do[​](#4-what-portal-does-not-do "Direct link to 4. What Portal does NOT do")

To set expectations, here are things people sometimes assume Portal handles but it doesn't:

* **It does not proxy layout from the local position to the host.** The teleported children take their size and position from the host's layout, not from where the `<Portal>` sits in the tree. If you need a "ghost" placeholder at the local position, render one yourself.
* **It does not bridge React context in any special way.** It doesn't need to: `createPortal`-style semantics already mean children read context from their React parent (the `<Portal>`), not from their physical DOM/native parent. If a context provider sits above the `<Portal>`, teleported children see it.
* **It does not implement focus, keyboard, or accessibility traversal across the teleport.** Native focus order and screen reader traversal follow the physical view hierarchy - i.e. the host's location, not the Portal's.

## See also[​](#see-also "Direct link to See also")

* [Portal API](/react-native-teleport/pr-preview/pr-124/docs/api/components/portal.md)
* [PortalHost API](/react-native-teleport/pr-preview/pr-124/docs/api/components/portal-host.md)
* [usePortal hook](/react-native-teleport/pr-preview/pr-124/docs/api/hooks/use-portal.md) - imperative access and `isHostAvailable` flag
* [Teleport guide](/react-native-teleport/pr-preview/pr-124/docs/guides/teleport.md) - for moving an *existing* view without unmounting it
