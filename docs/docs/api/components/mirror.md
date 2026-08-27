---
sidebar_position: 4
description: A transition-only visual duplicate of a named Portal subtree.
keywords:
  [
    react-native-teleport,
    react-native mirror,
    shared transition,
    shared element transition,
    view snapshot,
  ]
---

# Mirror

`Mirror` renders a visual duplicate of the subtree registered by a named
[`Portal`](./portal). It is intended for transition layers: the real source and
destination remain responsible for React state and interactions, while a
temporary `Mirror` supplies the pixels that you animate between them.

Unlike teleporting, mirroring does not move or re-parent the source. It also
does not create a second React component tree or duplicate component state.

:::warning Platform support

`Mirror` is available on **iOS and Android only**. The Web implementation
currently renders `null`.

:::

:::caution Experimental iOS backend

The current iOS implementation uses UIKit's private `_UIPortalView`. Treat
`Mirror` as experimental on iOS: private API availability and App Store
acceptance are not guaranteed across OS releases. This implementation detail
is intentionally not exposed through platform-specific React props.

:::

:::caution Android video surfaces

If the source Portal subtree contains a `SurfaceView`, the Android Mirror stays
empty and leaves the real source unchanged. A `SurfaceView` owns a separate
compositor surface, so drawing the View subtree cannot safely duplicate its
pixels.

Use a `TextureView` when live video must participate in normal View compositing.
Unlike `SurfaceView`, it is part of the View hierarchy drawn into the Mirror's
Canvas.

:::

## Props

### `name`

The required name of the source `Portal`. A `Mirror` draws the currently
registered Portal subtree with the same `name`.

Use a unique name for every simultaneously mounted source Portal. Registering
multiple Portals with the same name is undefined behavior.

Changing `name` while the Mirror is mounted switches the visual source. This is
useful when a high-resolution image becomes available during a transition.

### `style`

The style of the Mirror. It accepts
[`ViewStyle`](https://reactnative.dev/docs/view#style) props and defines the
Mirror's layout and animation surface.

The registered Portal subtree is scaled from its own bounds into the Mirror's
bounds. The source and Mirror therefore do not need to have the same size.

## Basic example

Give a local source `Portal` a name, then render a `Mirror` with the same name:

```tsx
import { Image, StyleSheet, View } from "react-native";
import { Mirror, Portal } from "react-native-teleport";

export default function MirroredPhoto() {
  return (
    <View style={styles.container}>
      <Portal name="photo">
        <Image
          source={{ uri: "https://example.com/photo.jpg" }}
          style={styles.sourceImage}
        />
      </Portal>

      <Mirror name="photo" style={styles.mirror} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sourceImage: {
    width: 120,
    height: 120,
  },
  mirror: {
    width: 300,
    height: 400,
  },
});
```

The 120 × 120 source is rendered into the 300 × 400 Mirror bounds. Wrap the
Mirror in your transition layer, or animate its `style`, without moving the
original subtree.

## Replacing the source during a transition

A common image-gallery flow starts with a preview and replaces it with a
full-resolution image as soon as that image is ready. Keep both possible
sources registered and change the Mirror's `name`:

```tsx
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Mirror, Portal } from "react-native-teleport";

export default function GalleryTransition() {
  const [fullImageReady, setFullImageReady] = useState(false);
  const mirrorSource = fullImageReady ? "photo-full" : "photo-preview";

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.hiddenSources}>
        <Portal name="photo-preview" style={styles.portalSource}>
          <Image
            source={{ uri: "https://example.com/photo-preview.jpg" }}
            style={StyleSheet.absoluteFillObject}
          />
        </Portal>

        <Portal name="photo-full" style={styles.portalSource}>
          <Image
            source={{ uri: "https://example.com/photo-full.jpg" }}
            style={StyleSheet.absoluteFillObject}
            onLoad={() => setFullImageReady(true)}
          />
        </Portal>
      </View>

      <Mirror name={mirrorSource} style={styles.transitionImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  hiddenSources: {
    position: "absolute",
    width: 120,
    height: 120,
    opacity: 0,
    overflow: "hidden",
  },
  portalSource: {
    width: 600,
    height: 800,
  },
  transitionImage: {
    width: 300,
    height: 400,
  },
});
```

Both source Portals are already mounted before source replacement, and
`onLoad` confirms that the full-resolution image is drawable. When
`fullImageReady` changes, the mounted Mirror starts drawing `photo-full`; it
does not need to be recreated. Do not switch to a source that has not mounted
and finished loading yet.

## Source boundary and ancestor styles

The named `Portal` is the boundary of the mirrored content. `Mirror`
intentionally does **not** inherit or reproduce `opacity`, clipping,
transforms, or position from containers outside that Portal.

For example, the previous `hiddenSources` container is transparent, clipped to
120 × 120, and positioned independently. The Mirror still draws the complete
600 × 800 `portalSource` into its own 300 × 400 bounds.

Styles and clipping **inside** the Portal subtree are different: they are part
of the source and therefore appear in the Mirror. Put any masking, rounded
corners, image resize mode, or other intentional visual treatment inside the
named Portal when it should be mirrored.

The Mirror source is limited to the Portal's own native bounds. Content drawn
outside those bounds is not guaranteed to appear, even if an outer ancestor
would otherwise allow it to overflow.

Use a local named Portal as the source. A `Portal` with `hostName` physically
moves its children to a `PortalHost`, outside the source Portal's native
subtree, so mirroring teleported children is not currently part of this
contract.

:::tip Hide the source without removing it

An ancestor with `opacity: 0` can hide the real source without hiding the
Mirror. Keep the Portal mounted and measurable; unmounting it or using a layout
that gives it zero-sized bounds leaves the Mirror without drawable content.

:::

## Interaction and lifecycle

`Mirror` is visual only and does not receive pointer events. User interactions,
accessibility behavior, refs, and component state continue to belong to the
real source or destination view.

- If the Mirror mounts before a matching Portal, it remains empty and starts
  drawing when that Portal registers.
- If `name` does not resolve to a registered Portal, the Mirror is empty.
- If the named Portal unmounts, the Mirror becomes empty.
- If `name` changes, the Mirror detaches from the old source and follows the
  Portal registered under the new name.
- Unmount the Mirror when the transition finishes, then reveal or continue
  rendering the real destination view.

This makes a Mirror a temporary transition representation rather than a second
application view.
