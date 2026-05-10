---
sidebar_position: 3
description: How Portal and PortalHost behave together over time - what gets rendered where, and how children move when components mount and unmount.
keywords:
  [
    react-native-teleport,
    portal,
    PortalHost,
    lifecycle,
    mount,
    unmount,
    teleport,
    behavior,
  ]
---

# Lifecycle & behavior

This page describes the contract between [`Portal`](../api/components/portal) and [`PortalHost`](../api/components/portal-host) - what renders where, and how children move as components mount and unmount.

The rules are designed to match what you'd intuitively expect from a portal system: children always end up _somewhere_ visible, and they survive transient changes to the host.

## 1. Static behavior

Given a fixed configuration that doesn't change over time, this is where children render.

| `Portal` configuration                                | Result                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| No `hostName` prop                                    | Children render **locally**, in place. `Portal` behaves like a transparent wrapper.         |
| `hostName="x"` and a `<PortalHost name="x" />` exists | Children are **teleported** into that host.                                                 |
| `hostName="x"` but no host with that name exists      | Children render **locally** as a fallback. As soon as a matching host mounts, they migrate. |

The "render locally as fallback" rule means a `Portal` is never a black hole - children are always attached to a live view tree, even if the host is missing.

:::tip Conditionally rendering when no host exists

If you'd rather render _nothing_ (or a different UI) while the host is missing instead of falling back locally, use the [`usePortal`](../api/hooks/use-portal) hook and read its `isHostAvailable` flag:

```tsx
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

:::

## 2. Dynamic behavior

The interesting cases happen when something changes. The library guarantees the following transitions:

### A host mounts after the Portal

Children that were rendering locally as a fallback are moved into the new host automatically. The React tree doesn't re-render - only the native views are re-parented.

### A host unmounts while the Portal is still alive

Children are pulled back to the Portal's local position so they remain attached to a live view tree. They are _not_ destroyed. Component state, refs, and any imperative native state (animation values, video playback position, scroll offset, etc.) are preserved.

### A host remounts (mount → unmount → mount)

On each cycle, children follow the host. Mounting a host with the same name a second time picks up exactly where the first cycle left off - there's no special "first mount" logic. This is the foundation for `PersistedPortal`-style patterns where a Portal outlives its host(s).

### Portal's `hostName` prop changes

Children migrate from the previous target (host or local) to the new target. If the new `hostName` has no matching host, children fall back to local rendering until that host appears.

### Portal unmounts

Its children unmount with it, regardless of where they currently live. The host doesn't keep orphaned children - `Portal` owns its children's React lifecycle, the host only owns their physical attachment point.

### Host unmounts

Only the host disappears. All Portals targeting it survive, with their children intact (rendering locally per the rule above).

## 3. Identity and ordering

These are the rules that are easy to get wrong if you don't know them.

- **Multiple Portals targeting the same host** preserve order, with one important nuance:
  - **When teleported in the same commit** (e.g. both rendered at the same time on initial mount), their children appear in the host in the same order they sit in the JSX tree. If `<Portal A />` comes before `<Portal B />` in source, `A`'s children gets mounted earlier in the host than `B`'s.
  - **When teleported in different commits** (e.g. `B` mounts later, after `A` is already in the host), order is defined by _arrival time_, not JSX position. The newcomer is appended after whatever is already in the host, even if it appears earlier in the source.
- **Host names are matched as strings.** Two `PortalHost` instances with the same `name` mounted at the same time is undefined behavior - only the most recently registered one will receive new portals. Unmounting either may leave children stranded. Use unique names per active host.
- **React identity is preserved across host mount/unmount cycles.** A teleported `<Video />` does not reset its playback position when its host unmounts and remounts. This is the whole reason you'd reach for a Portal that outlives its host.

:::warning Layout is not preserved at the original location

`Portal` does not reserve space at its position. Once children are teleported into a host, they take their size and position from the **host's** layout - the original location collapses to zero.

If you need to avoid surrounding content reflowing while children are teleported away, render a wrapper view at the original position with the same dimensions as the teleported children:

```tsx
<View style={{ width: 200, height: 60 }}>
  <Portal hostName="overlay">
    <View style={{ width: 200, height: 60 }}>
      <ChildContent />
    </View>
  </Portal>
</View>
```

The outer `<View>` keeps its slot in the layout regardless of whether the inner content is currently teleported.

:::

## See also

- [Portal API](../api/components/portal) - declarative component that teleports its children into a named host
- [PortalHost API](../api/components/portal-host) - the destination where teleported children are mounted
- [usePortal hook](../api/hooks/use-portal) - imperative access and `isHostAvailable` flag
- [Teleport guide](./teleport) - for moving an _existing_ view without unmounting it
