# Building Photos app transitions in React Native

<!-- -->

Open the Photos app and tap a picture. The thumbnail doesn't vanish to make room for a new screen: it lifts out of the grid, grows until it fills the display, and somewhere on the way it quietly turns into a sharp, full-resolution photo. Close it, and the photo shrinks back into the exact cell it came from.

In this guide we'll build that transition in React Native, one step at a time. The sharp photo replaces the blurry preview **the moment it finishes loading**: in the middle of the animation if the network is fast, right after it if the network is slow. Either way there are no flickers, no blank frames and no jumps.

This is what we're building, recorded on an iPhone simulator from the code in this guide:

[](/react-native-teleport/pr-preview/pr-205/video/photos-app-transition.mp4)

<br />

## At a glance[​](#at-a-glance "Direct link to At a glance")

* **Matches production photo apps.** The tapped thumbnail expands instantly, without waiting for the network, and the sharp photo replaces it as soon as it's downloaded. Slow networks, fast networks and cached photos are all handled.

* **Resource efficient.**

  * Lists render small, low-res thumbnails only, which keeps long lists fast and light on memory.
  * The full-res photo is requested only when the user opens it, and rendered exactly once. There is no hidden second copy of a heavy image during the transition.
  * The thumbnail is moved, not copied. `<Portal>` re-parents the existing native view, so nothing is re-mounted, re-downloaded or re-decoded.
  * No aggressive caching or prefetching is required. A plain React Native `<Image>` is enough.

* **Extensible to stateful content.** Because the native view itself moves, anything stateful inside it keeps its state: videos and GIFs keep playing and Lottie animations keep running throughout the transition.

* **Applicable beyond galleries.** The same pattern fits chat apps with media attachments, social feeds with multi-image posts (Facebook, X, Instagram carousels) and product galleries in e-commerce apps.

## How it works[​](#how-it-works "Direct link to How it works")

Here is the whole transition, taken apart into the layers that make it work. Hover over (or tap) any layer or image to see what it does.

Animation transcript:

1. The gallery: a FlatList of low-res thumbnails. A PortalHost “root” waits above the navigator.
2. Every thumbnail is wrapped in a \<Portal>. Without a host name, it renders in place, inside the FlatList.
3. Tap teleports the thumbnail into the root PortalHost. \<Portal hostName="root"> re-parents the same native view, in one frame.
4. The detail screen mounts the full-res photo, invisible. Its \<Image> sits at opacity 0 on the thumbnail’s path while it loads.
5. Both ride the same spring, but you only see the low-res one. One progress value drives translate, scale and height on both layers.
6. When onLoad fires mid-flight, one commit swaps them. set({ visibility: { source: 0, target: 1 } }) hands the image over to the detail screen in the same native frame.
7. The full-res photo finishes the animation. The hidden thumbnail keeps pace until it ends.
8. When the animation ends, the thumbnail teleports back to its cell. It stays hidden while the photo is open, and Close fades in.
9. Close runs the same interpolation in reverse. goBack springs progress back to 0, and the full-res photo shrinks into the cell on the detail screen.
10. Then the thumbnail shows up and the detail screen closes. visibility goes back to { source: 1, target: 0 }, and navigation.goBack() removes the screen.
11. What users see: one continuous image, sharp as soon as it’s ready. No flicker, no blank frames, no second decode of the full-res photo.

Three layers take part in the transition:

1. **Gallery screen.** A `FlatList` of low-res thumbnails. Each thumbnail is wrapped in a `<Portal>`.
2. **Detail screen.** Pushed as a transparent modal, without a native animation. It renders the full-res `<Image>`, hidden at first.
3. **Root `PortalHost`.** Rendered by `<PortalProvider>` above the navigator, so anything teleported into it is drawn on top of every screen.

The thumbnail starts the animation, because it's already on screen. The full-res photo finishes it, because it's the one worth looking at. The trick is to hand over from one to the other without the user noticing. Each step below adds one piece of this, with its own part of the animation.

## Why build a custom transition?[​](#why-build-a-custom-transition "Direct link to Why build a custom transition?")

### Ready-made viewers[​](#ready-made-viewers "Direct link to Ready-made viewers")

Ready-made image viewers such as [Galeria](https://github.com/nandorojo/galeria) give you a polished native viewer with one component: pinch to zoom, swipe to dismiss and paging between images work out of the box, and it supports images and videos. If that's all your app needs, it's a great choice.

The trade-off is control over the viewer UI. Galeria's full-screen viewer is a native view controller, and its README documents only a few appearance options (theme, blur overlay and page indicators). Rendering your own React Native views inside the viewer isn't supported: the maintainer [noted](https://github.com/nandorojo/galeria/issues/9) that it would need a fork and a way to render React Native views in a native view controller, which isn't trivial. Requests for a [custom header](https://github.com/nandorojo/galeria/issues/99), a [custom close button](https://github.com/nandorojo/galeria/issues/49) and [share or save actions](https://github.com/nandorojo/galeria/issues/113) are still open.

With `react-native-teleport`, the full-screen viewer is a regular React Native screen, so it can contain anything your design needs: a custom header, captions, comments, action buttons or a tab bar.

|                          | Ready-made viewer (Galeria)                          | Custom transition (this guide)                                                    |
| ------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Viewer UI                | Native, with a few appearance options                | Any React Native UI: header, captions, actions, tab bar                           |
| Transition               | Built in                                             | Yours to shape: path, spring and timing are written with Reanimated               |
| Full-res photo           | A separate image for the expanded state is supported | Low-res thumbnail first, full-res swapped in as soon as it loads, even mid-flight |
| Content in the viewer    | Images and videos                                    | Any React Native view: images, videos, GIFs, Lottie, keeping their state          |
| Zoom, paging, swipe away | Built in                                             | Add them with `react-native-gesture-handler` and Reanimated                       |
| Setup                    | One component                                        | The nine files in this guide                                                      |

### Native transitions move views too[​](#native-transitions-move-views-too "Direct link to Native transitions move views too")

Moving a view into a layer above every screen isn't a trick invented for React Native. Native transition APIs do the same thing and hide it behind a higher-level API:

* **Android.** Activity shared element transitions draw the shared views in an overlay instead of the normal view hierarchy, and that's the default ([`Window.setSharedElementsUseOverlay`](https://developer.android.com/reference/android/view/Window#setSharedElementsUseOverlay%28boolean%29)). In Jetpack Compose, a shared element is [elevated into an overlay](https://developer.android.com/develop/ui/compose/animation/shared-elements/customize#clip-overlays) when the transition starts and dropped back into its own `DrawScope` when it ends.
* **iOS.** A custom view controller transition runs in the transition context's [`containerView`](https://developer.apple.com/documentation/uikit/uiviewcontrollercontexttransitioning/containerview), which acts as the superview of every view involved in the animation. Since iOS 18, the [zoom transition](https://developer.apple.com/documentation/uikit/uiviewcontroller/transition/zoom%28options:sourceviewprovider:%29) wraps this into a single API: you return the source view, and UIKit animates the rest.

These APIs work well when you need exactly the transition they provide. As soon as you need something they don't expose, such as your own header over the photo, a mid-flight swap from a low-res to a full-res image or the same behavior on both platforms, you're back to the low-level building blocks, written twice, in Kotlin and in Swift.

`react-native-teleport` takes the same route as [`react-native-gesture-handler`](https://github.com/software-mansion/react-native-gesture-handler), [`react-native-reanimated`](https://github.com/software-mansion/react-native-reanimated) and [`react-native-screens`](https://github.com/software-mansion/react-native-screens). Each of them exposes a low-level native capability to JavaScript (native gesture recognizers, animations on the UI thread, native navigation containers), and you build the high-level behavior on top of it once, for every platform. Here, that capability is moving a native view to another parent.

### Comparing approaches[​](#comparing-approaches "Direct link to Comparing approaches")

There are several ways to animate an item from a list to full screen. They differ in what happens to the item's content while it moves:

|                                      | Animate in place                                             | Render a copy                                               | Animate a snapshot                                  | View Transitions (web)                                                                     | Teleport (this guide)                           |
| ------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| How it works                         | Scale the cell with `transform` and `zIndex` inside the list | Mount a second instance in an overlay or on the next screen | Capture a bitmap of the view and animate the bitmap | The browser captures the old state as a static image and morphs it into the live new state | Move the native view into the root `PortalHost` |
| Heavy content rendered once          | ✅                                                           | ❌ Twice, two instances in memory                           | 🟡 Once, plus a bitmap of it                        | 🟡 Once, plus a bitmap of the old state                                                    | ✅                                              |
| Videos, GIFs and Lottie keep playing | ✅                                                           | ❌ The copy starts over                                     | ❌ Frozen for the whole animation                   | 🟡 Frozen in the old state, live in the new one                                            | ✅ It's the same native view                    |
| Not clipped by the list              | ❌                                                           | ✅                                                          | ✅                                                  | ✅                                                                                         | ✅                                              |
| Drawn above headers and tab bars     | ❌                                                           | ✅                                                          | ✅                                                  | ✅                                                                                         | ✅                                              |
| Works in React Native                | ✅                                                           | ✅                                                          | ✅                                                  | ❌ Web only                                                                                | ✅ On iOS, Android and web                      |

✅ yes, 🟡 partially, ❌ no.

The full-res photo on the detail screen isn't a copy of the thumbnail: it's a separate, larger image, rendered only there, and the thumbnail hands over to it as soon as it loads.

What about View Transitions?

On the web, the [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using) and React's [`<ViewTransition>`](https://react.dev/reference/react/ViewTransition) (which [works only in the DOM so far](https://react.dev/blog/2026/09/09/react-19-3)) capture the old state as a static image and animate it into the live new state. The snapshots live only as long as the transition: when its animations finish, they're destroyed, unless you hold them with the experimental [`ViewTransition.waitUntil()`](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/waitUntil). If the full-res photo hasn't loaded by then, the page shows whatever the new state renders. So you still need the low-res photo as a placeholder in the new state and a handoff to the full-res one, the same idea as in this guide. Because the new state is live, a photo that loads during the transition does appear mid-flight.

## Compared with the Instagram-like transitions[​](#compared-with-the-instagram-like-transitions "Direct link to Compared with the Instagram-like transitions")

If you've read the [Instagram-like transitions](/react-native-teleport/pr-preview/pr-205/docs/recipes/instagram-shared-transitions.md) recipe, most of the building blocks will look familiar: a root `PortalHost`, a Zustand store with a shared `progress` value, `measureInWindow` and a transparent modal. Two ideas are new here:

* **The thumbnail goes back.** In the Instagram recipe, the video travels from the feed into the Reels screen and stays there until you go back. Here the thumbnail only carries the animation: once the full-res photo has taken over, the thumbnail returns to its cell, and the detail screen owns the photo.
* **Two sources in one transition.** The Instagram recipe moves one video from start to finish. Here a cheap low-res thumbnail starts the animation instantly, and the full-res photo replaces it the moment it loads, even mid-flight.

The second idea goes beyond resolution. The handoff works between any two views that cover the same rectangle, so the detail screen could, for example, swap in an HDR version of the photo while the list keeps lightweight SDR thumbnails.

## Prerequisites[​](#prerequisites "Direct link to Prerequisites")

Install these packages and follow their setup guides:

* `react-native-teleport`
* `react-native-reanimated` (with `react-native-worklets`)
* `@react-navigation/native` and `@react-navigation/native-stack`
* `react-native-safe-area-context`
* `zustand`

All files in this guide live in one folder. By the end of the guide you'll have nine of them:

```
App.tsx            root providers
navigation.tsx     the two screens
photos.ts          photo data
constants.ts       grid size and spring config
hero.ts            the transition store
useMeasure.ts      measures a thumbnail on screen
PhotoPreview.tsx   a thumbnail that can teleport
PhotoGallery.tsx   the grid screen
PhotoDetail.tsx    the full-screen viewer
```

When a step changes a file, the changed lines are highlighted.

## Step 1: Build the grid[​](#step-1-build-the-grid "Direct link to Step 1: Build the grid")

Let's start with a plain photo grid: no viewer, no animations, nothing teleported.

The grid has three columns. `SCALE` is how many times the full-width photo is wider than a thumbnail; we'll need it for the animation:

constants.ts

```
import { Dimensions } from "react-native";

export const SCREEN_WIDTH = Math.min(Dimensions.get("window").width, 540);
export const COLUMNS = 3;
export const THUMB_SIZE = SCREEN_WIDTH / COLUMNS;
export const SCALE = SCREEN_WIDTH / THUMB_SIZE;
```

Each photo comes in two sizes: a small thumbnail for the grid and the full-size photo for the viewer. The thumbnail keeps the **same aspect ratio** as the full image: when both are cropped with `resizeMode="cover"` into the same rectangle, they show exactly the same part of the photo, so the swap at the end of this guide doesn't shift the content.

photos.ts

```
export type Photo = {
  id: string;
  thumbnail: string;
  fullSize: string;
  width: number;
  height: number;
};

const PHOTO_DATA: { id: number; width: number; height: number }[] = [
  { id: 10, width: 1080, height: 720 },
  { id: 15, width: 720, height: 1080 },
  { id: 20, width: 1080, height: 720 },
  { id: 25, width: 1080, height: 1080 },
  { id: 29, width: 1080, height: 720 },
  { id: 36, width: 720, height: 1080 },
  { id: 42, width: 1080, height: 720 },
  { id: 49, width: 1080, height: 720 },
  { id: 54, width: 720, height: 1080 },
  { id: 58, width: 1080, height: 720 },
  { id: 75, width: 1080, height: 720 },
  { id: 76, width: 720, height: 1080 },
];

const THUMB_SHORT_SIDE = 150;

const PHOTOS: Photo[] = PHOTO_DATA.map(({ id, width, height }) => {
  // Match the thumbnail's aspect to the full image so picsum returns the same
  // crop window — otherwise the cover-cropped thumb and the full image show
  // different parts of the original, producing a content jump at handoff.
  const thumbW =
    width >= height
      ? Math.round(THUMB_SHORT_SIDE * (width / height))
      : THUMB_SHORT_SIDE;
  const thumbH =
    height > width
      ? Math.round(THUMB_SHORT_SIDE * (height / width))
      : THUMB_SHORT_SIDE;

  return {
    id: String(id),
    thumbnail: `https://picsum.photos/id/${id}/${thumbW}/${thumbH}`,
    fullSize: `https://picsum.photos/id/${id}/${width}/${height}`,
    width,
    height,
  };
});

export default PHOTOS;
```

Why thumbnails matter

An image's memory use depends on its dimensions, not its file size. Compression only shrinks the download: to draw a JPEG, iOS and Android decode it into 4 bytes per pixel (red, green, blue and an alpha or padding byte; see [Apple's WWDC talk on memory](https://developer.apple.com/videos/play/wwdc2018/416/) and Android's [`ARGB_8888`](https://developer.android.com/reference/android/graphics/Bitmap.Config#ARGB_8888)). Take the square photo from this guide:

|           | Pixels      | File (JPEG) | In memory |
| --------- | ----------- | ----------- | --------- |
| Thumbnail | 150 × 150   | 8 KB        | 90 KB     |
| Full-res  | 1080 × 1080 | 225 KB      | 4.7 MB    |

The full-res photo needs about 50 times more memory than its thumbnail. A grid of thumbnails stays fast and light no matter how long the list gets.

A thumbnail is an image in a fixed-size `View`. That fixed size will matter later: when the image leaves its cell, the cell keeps its place.

PhotoPreview\.tsx

```
import React from "react";
import { Image, View } from "react-native";

import type { Photo } from "./photos";
import { THUMB_SIZE } from "./constants";

type Props = {
  photo: Photo;
};

function PhotoPreview({ photo }: Props) {
  return (
    <View
      style={{
        height: THUMB_SIZE,
        width: THUMB_SIZE,
      }}
    >
      <Image
        style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
        source={{ uri: photo.thumbnail }}
        resizeMode="cover"
      />
    </View>
  );
}

export default React.memo(PhotoPreview);
```

The gallery is a regular `FlatList`:

PhotoGallery.tsx

```
import { FlatList, StyleSheet, View } from "react-native";

import PHOTOS from "./photos";
import PhotoPreview from "./PhotoPreview";

function PhotoGallery() {
  return (
    <View style={styles.container}>
      <FlatList
        data={PHOTOS}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => <PhotoPreview photo={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export default PhotoGallery;
```

It lives in a native stack, so it gets a header titled "Photos":

navigation.tsx

```
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import PhotoGallery from "./PhotoGallery";

export type RootStackParamList = {
  PhotoGallery: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PhotoGallery"
        component={PhotoGallery}
        options={{ title: "Photos" }}
      />
    </Stack.Navigator>
  );
}
```

App.tsx

```
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import RootStack from "./navigation";

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootStack />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
```

Run the app, and you get a grid of photos:

![A grid of twelve photo thumbnails, three per row, under a header titled Photos.](/react-native-teleport/pr-preview/pr-205/img/photo-gallery-transition/step1-grid.jpg)

## Step 2: Open a full-screen viewer[​](#step-2-open-a-full-screen-viewer "Direct link to Step 2: Open a full-screen viewer")

Now make the photos tappable. A tap opens a detail screen with the full-res photo and a Close button.

The detail screen is a transparent modal without a native animation. We'll draw the transition ourselves later, and the gallery has to stay visible underneath while the photo is still growing:

navigation.tsx (updated)

```
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import PhotoDetail from "./PhotoDetail";
import PhotoGallery from "./PhotoGallery";
import type { Photo } from "./photos";

export type RootStackParamList = {
  PhotoGallery: undefined;
  PhotoDetail: { photo: Photo };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PhotoGallery"
        component={PhotoGallery}
        options={{ title: "Photos" }}
      />
      <Stack.Screen
        name="PhotoDetail"
        component={PhotoDetail}
        options={{
          headerShown: false,
          animation: "none",
          presentation: "containedTransparentModal",
        }}
      />
    </Stack.Navigator>
  );
}
```

Why a transparent modal?

A regular screen push hides the previous screen. A transparent modal keeps the gallery rendered and visible behind the detail screen, so during the transition you see the photo grow over the grid, not over an empty background. It also leaves room for a swipe-down-to-dismiss gesture later, where the user needs to see the grid underneath while dragging.

The detail screen draws a black backdrop, the full-res photo at full width and a Close button:

PhotoDetail.tsx

```
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StaticScreenProps } from "@react-navigation/native";

import type { Photo } from "./photos";
import { SCREEN_WIDTH } from "./constants";

type PhotoDetailProps = StaticScreenProps<{ photo: Photo }>;

function PhotoDetail({ route }: PhotoDetailProps) {
  const { photo } = route.params;
  const navigation = useNavigation();
  const { top: safeAreaTop } = useSafeAreaInsets();

  const fullHeight = SCREEN_WIDTH * (photo.height / photo.width);

  return (
    <View style={styles.container}>
      <View style={styles.backdrop} />
      <Image
        source={{ uri: photo.fullSize }}
        style={{
          marginTop: safeAreaTop,
          width: SCREEN_WIDTH,
          height: fullHeight,
        }}
        resizeMode="cover"
        fadeDuration={0}
      />
      <Pressable
        style={[styles.backButton, { top: safeAreaTop + 10 }]}
        onPress={navigation.goBack}
      >
        <Text style={styles.backText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PhotoDetail;
```

Each thumbnail reports the tap:

PhotoPreview\.tsx (updated)

```
import React from "react";
import { Image, TouchableWithoutFeedback, View } from "react-native";

import type { Photo } from "./photos";
import { THUMB_SIZE } from "./constants";

type Props = {
  photo: Photo;
  onOpen: (photo: Photo) => void;
};

function PhotoPreview({ photo, onOpen }: Props) {
  return (
    <TouchableWithoutFeedback onPress={() => onOpen(photo)}>
      <View
        style={{
          height: THUMB_SIZE,
          width: THUMB_SIZE,
        }}
      >
        <Image
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
          source={{ uri: photo.thumbnail }}
          resizeMode="cover"
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

export default React.memo(PhotoPreview);
```

And the gallery opens the detail screen:

PhotoGallery.tsx (updated)

```
import { FlatList, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import PHOTOS, { type Photo } from "./photos";
import PhotoPreview from "./PhotoPreview";
import type { RootStackParamList } from "./navigation";

function PhotoGallery() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const onPhotoOpen = (photo: Photo) => {
    navigation.navigate("PhotoDetail", { photo });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={PHOTOS}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => (
          <PhotoPreview photo={item} onOpen={onPhotoOpen} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export default PhotoGallery;
```

It works, but it doesn't feel like a photo app yet. Watch the moment right after each tap:

[](/react-native-teleport/pr-preview/pr-205/video/photos-app-no-transition.mp4)

<br />

The detail screen pops in, stays black for a moment, and only then does the photo appear. Nothing connects the photo to the thumbnail you tapped.

Why is the screen black at first?

The full-res photo isn't in memory yet. The tap starts the download, then the image has to be decoded, and only after that can it be drawn. In the recording above it takes about 150 ms on a fast connection; on a cellular network it can take seconds. Meanwhile, the thumbnail you just tapped is already decoded and on screen.

Can't we just prefetch the full-res photos?

`Image.prefetch(url)` downloads an image into the cache ahead of time. That's fine for a handful of images, but galleries, chats and feeds have thousands. Prefetching every full-res photo downloads megabytes that most users never look at, and keeping them decoded in memory for an instant display is how apps get killed with out-of-memory errors: a single 12-megapixel photo takes about 48 MB once decoded (4032 × 3024 × 4 bytes). And even a cached photo still has to be decoded before it shows up, so prefetching shortens the black screen, but doesn't remove it.

So instead of waiting for the full-res photo, we'll start the animation with what's already on screen: the thumbnail.

## Step 3: Add the teleport infrastructure[​](#step-3-add-the-teleport-infrastructure "Direct link to Step 3: Add the teleport infrastructure")

Three pieces make the transition possible. None of them changes what you see yet.

### The root `PortalHost`[​](#the-root-portalhost "Direct link to the-root-portalhost")

`<PortalProvider>` renders a `PortalHost` named `"root"` above its children. Wrap the navigator with it:

App.tsx (updated)

```
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalProvider } from "react-native-teleport";

import RootStack from "./navigation";

export default function App() {
  return (
    <SafeAreaProvider>
      <PortalProvider>
        <NavigationContainer>
          <RootStack />
        </NavigationContainer>
      </PortalProvider>
    </SafeAreaProvider>
  );
}
```

Why above the navigator?

Anything teleported into the root host is drawn above every screen: the gallery, the detail screen, the native header and a tab bar if you have one. That's exactly where a flying photo belongs. Inside the list it would be clipped by the `FlatList` and drawn under the header.

### The transition store[​](#the-transition-store "Direct link to The transition store")

A small [Zustand](https://github.com/pmndrs/zustand) store coordinates both screens. For now it only knows which photo is moving (`id`) and where its thumbnail was on screen (`position`). We'll grow it with every step:

hero.ts

```
import { create } from "zustand";

type Position = {
  x: number;
  y: number;
};

interface HeroStore {
  /** Which photo is currently animating (Portal teleport) */
  id: string;
  /** Measured position of the thumbnail before transition */
  position: Position | undefined;
  set: (newState: Partial<Omit<HeroStore, "set">>) => void;
  goBack: (callback: () => void) => void;
  goForward: (id: string, x: number, y: number, callback: () => void) => void;
}

export const useHeroTransition = create<HeroStore>((set) => ({
  id: "",
  position: undefined,
  set: (newState) => set((state) => ({ ...state, ...newState })),

  goBack: (callback: () => void) => {
    set({
      id: "",
      position: undefined,
    });
    callback();
  },
  goForward: (id: string, x: number, y: number, callback: () => void) => {
    set({
      position: { x, y },
      id,
    });
    callback();
  },
}));
```

Why Zustand?

Components subscribe only to the slices they need. Each thumbnail selects `s.id === photo.id`, so a transition re-renders the tapped thumbnail and the detail screen, not the whole grid.

### Measuring the thumbnail[​](#measuring-the-thumbnail "Direct link to Measuring the thumbnail")

The animation starts from the thumbnail's position in the window:

useMeasure.ts

```
import { Platform, type View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MeasureCallback = (x: number, y: number) => void;

const useMeasure = (viewRef: React.RefObject<View | null>) => {
  const insets = useSafeAreaInsets();

  return (callback: MeasureCallback) => {
    // @ts-expect-error
    viewRef.current?.measureInWindow((x: number, y: number) => {
      // it looks like enabled edge-to-edge (Android 16+) produces incorrect
      // measurement offset
      if (Platform.OS === "android") {
        return callback(x, y + insets.top);
      }

      return callback(x, y);
    });
  };
};

export default useMeasure;
```

## Step 4: Teleport the thumbnail into the root host[​](#step-4-teleport-the-thumbnail-into-the-root-host "Direct link to Step 4: Teleport the thumbnail into the root host")

Here comes the core trick. When the user taps a thumbnail, we measure it, store its position and switch its `<Portal>` to the root host:

PhotoPreview\.tsx (updated)

```
import React, { useCallback, useRef } from "react";
import { Image, TouchableWithoutFeedback, View } from "react-native";
import { Portal } from "react-native-teleport";

import type { Photo } from "./photos";
import { THUMB_SIZE } from "./constants";
import { useHeroTransition } from "./hero";
import useMeasure from "./useMeasure";

type Props = {
  photo: Photo;
  onOpen: (photo: Photo) => void;
};

function PhotoPreview({ photo, onOpen }: Props) {
  const ref = useRef<View>(null);
  const measure = useMeasure(ref);
  const isAnimating = useHeroTransition((s) => s.id === photo.id);
  const position = useHeroTransition((s) =>
    s.id === photo.id ? s.position : undefined,
  );
  const goForward = useHeroTransition((s) => s.goForward);

  const onPress = useCallback(() => {
    if (useHeroTransition.getState().id !== "") return;

    measure((x, y) => {
      goForward(photo.id, x, y, () => onOpen(photo));
    });
  }, [photo, goForward, onOpen, measure]);

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View
        // @ts-expect-error ref type mismatch between View component and host instance
        ref={ref}
        style={{
          height: THUMB_SIZE,
          width: THUMB_SIZE,
        }}
      >
        <Portal hostName={position && isAnimating ? "root" : undefined}>
          <View
            style={
              isAnimating
                ? {
                    top: position?.y,
                    left: position?.x,
                  }
                : undefined
            }
          >
            <Image
              style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
              source={{ uri: photo.thumbnail }}
              resizeMode="cover"
            />
          </View>
        </Portal>
      </View>
    </TouchableWithoutFeedback>
  );
}

export default React.memo(PhotoPreview);
```

From the user's point of view, nothing has moved yet: the thumbnail is positioned at exactly the coordinates it had in the grid. But it isn't in the grid anymore. The same native view now lives in the root host, above every screen.

The Close button now goes through the store, which clears `id` and sends the thumbnail back into its cell:

PhotoDetail.tsx (updated)

```
import { useCallback } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StaticScreenProps } from "@react-navigation/native";

import type { Photo } from "./photos";
import { SCREEN_WIDTH } from "./constants";
import { useHeroTransition } from "./hero";

type PhotoDetailProps = StaticScreenProps<{ photo: Photo }>;

function PhotoDetail({ route }: PhotoDetailProps) {
  const { photo } = route.params;
  const goBack = useHeroTransition((s) => s.goBack);
  const navigation = useNavigation();
  const { top: safeAreaTop } = useSafeAreaInsets();

  const fullHeight = SCREEN_WIDTH * (photo.height / photo.width);

  const onGoBack = useCallback(() => {
    goBack(navigation.goBack);
  }, [navigation, goBack]);

  return (
    <View style={styles.container}>
      <View style={styles.backdrop} />
      <Image
        source={{ uri: photo.fullSize }}
        style={{
          marginTop: safeAreaTop,
          width: SCREEN_WIDTH,
          height: fullHeight,
        }}
        resizeMode="cover"
        fadeDuration={0}
      />
      <Pressable
        style={[styles.backButton, { top: safeAreaTop + 10 }]}
        onPress={onGoBack}
      >
        <Text style={styles.backText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PhotoDetail;
```

Run it and tap a photo. The detail screen opens as before, but the thumbnail you tapped is still visible on top of it, right where it was:

![The detail screen with the full-res photo at the top, and the tapped low-res thumbnail still drawn on top of the black backdrop at its old grid position.](/react-native-teleport/pr-preview/pr-205/img/photo-gallery-transition/step4-teleported.jpg)

Animation transcript:

1. Every thumbnail is wrapped in a \<Portal>. Without a host name, it renders in place, inside the FlatList.
2. Tap teleports the thumbnail into the root PortalHost. \<Portal hostName="root"> re-parents the same native view, in one frame.

Moved, not copied

The thumbnail isn't re-created in the root host. `<Portal>` re-parents the existing native view, so the image isn't re-downloaded or re-decoded, and a video in its place would keep playing. Its wrapper `View` stays behind and keeps the cell's size, so the list doesn't reflow.

## Step 5: Animate it to full screen[​](#step-5-animate-it-to-full-screen "Direct link to Step 5: Animate it to full screen")

Time to make it fly. Add a spring config:

constants.ts (updated)

```
import { Dimensions } from "react-native";

export const SCREEN_WIDTH = Math.min(Dimensions.get("window").width, 540);
export const COLUMNS = 3;
export const THUMB_SIZE = SCREEN_WIDTH / COLUMNS;
export const SCALE = SCREEN_WIDTH / THUMB_SIZE;
export const SPRING_CONFIG = {
  mass: 1.2,
  damping: 1000,
  stiffness: 500,
  overshootClamping: false,
};
```

The store gets a `progress` shared value that goes from `0` (thumbnail in its cell) to `1` (photo at full screen), a `direction`, and `visibility` for the two images. `goForward` updates the store first, which teleports the thumbnail, and starts the spring and the navigation in the next frame:

hero.ts (updated)

```
import {
  type SharedValue,
  makeMutable,
  runOnJS,
  withSpring,
} from "react-native-reanimated";
import { create } from "zustand";
import { SPRING_CONFIG } from "./constants";

type Position = {
  x: number;
  y: number;
};

interface HeroStore {
  direction: "forward" | "backward" | "neutral";
  /** Which photo is currently animating (Portal teleport) */
  id: string;
  /** Animation progress [0..1] */
  progress: SharedValue<number>;
  /** Measured position of the thumbnail before transition */
  position: Position | undefined;
  visibility: {
    /** Opacity of the source (thumbnail in grid) */
    source: number;
    /** Opacity of the target (full-res image on detail screen) */
    target: number;
  };
  set: (newState: Partial<Omit<HeroStore, "set">>) => void;
  isAnimationCompleted: boolean;
  transitionCompleted: () => void;
  goBack: (callback: () => void) => void;
  goForward: (id: string, x: number, y: number, callback: () => void) => void;
}

export const useHeroTransition = create<HeroStore>((set, get) => ({
  direction: "neutral",
  id: "",
  position: undefined,
  visibility: { source: 1, target: 0 },
  progress: makeMutable(0),
  isAnimationCompleted: false,
  set: (newState) => set((state) => ({ ...state, ...newState })),

  transitionCompleted: () => {
    set({ isAnimationCompleted: true });
  },

  goBack: (callback: () => void) => {
    get().progress.set(0);
    set({
      direction: "neutral",
      id: "",
      position: undefined,
      visibility: { source: 1, target: 0 },
      isAnimationCompleted: false,
    });
    callback();
  },
  goForward: (id: string, x: number, y: number, callback: () => void) => {
    set({
      direction: "forward",
      position: { x, y },
      visibility: { source: 1, target: 0 },
      isAnimationCompleted: false,
      id,
    });

    const transitionCompleted = get().transitionCompleted;
    requestAnimationFrame(() => {
      get().progress.set(
        withSpring(1, SPRING_CONFIG, () => {
          runOnJS(transitionCompleted)();
        }),
      );
      callback();
    });
  },
}));
```

The thumbnail turns every `progress` value into a position, a scale and a height:

PhotoPreview\.tsx (updated)

```
import React, { useCallback, useRef } from "react";
import { StyleSheet, TouchableWithoutFeedback, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Portal } from "react-native-teleport";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Photo } from "./photos";
import { SCALE, SCREEN_WIDTH, THUMB_SIZE } from "./constants";
import { useHeroTransition } from "./hero";
import useMeasure from "./useMeasure";

type Props = {
  photo: Photo;
  onOpen: (photo: Photo) => void;
};

function PhotoPreview({ photo, onOpen }: Props) {
  const ref = useRef<View>(null);
  const measure = useMeasure(ref);
  const isAnimating = useHeroTransition((s) => s.id === photo.id);
  const position = useHeroTransition((s) =>
    s.id === photo.id ? s.position : undefined,
  );
  const progress = useHeroTransition((s) => s.progress);
  const goForward = useHeroTransition((s) => s.goForward);
  const { top: safeAreaTop } = useSafeAreaInsets();

  // Height the full image takes at thumbnail scale
  const fullImageHeight = SCREEN_WIDTH * (photo.height / photo.width);
  const diff = fullImageHeight / SCALE - THUMB_SIZE;

  const animatedHeight = useAnimatedStyle(
    () => ({
      height: isAnimating
        ? interpolate(progress.value, [0, 1], [THUMB_SIZE, THUMB_SIZE + diff])
        : THUMB_SIZE,
    }),
    [isAnimating, diff],
  );

  const transform = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: interpolate(
            progress.value,
            [0, 1],
            [0, -(position?.x ?? 0)],
          ),
        },
        {
          translateY: interpolate(
            progress.value,
            [0, 1],
            [0, safeAreaTop - (position?.y ?? 0)],
          ),
        },
        {
          scale: interpolate(progress.value, [0, 1], [1, SCALE]),
        },
      ],
    };
  }, [position, safeAreaTop]);

  const onPress = useCallback(() => {
    if (useHeroTransition.getState().id !== "") return;

    measure((x, y) => {
      goForward(photo.id, x, y, () => onOpen(photo));
    });
  }, [photo, goForward, onOpen, measure]);

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View
        // @ts-expect-error ref type mismatch between View component and host instance
        ref={ref}
        style={{
          height: THUMB_SIZE,
          width: THUMB_SIZE,
        }}
      >
        <Portal hostName={position && isAnimating ? "root" : undefined}>
          <Animated.View
            style={
              isAnimating
                ? [
                    styles.animating,
                    {
                      top: position?.y,
                      left: position?.x,
                    },
                    transform,
                  ]
                : undefined
            }
          >
            <Animated.Image
              style={[{ width: THUMB_SIZE }, animatedHeight]}
              source={{ uri: photo.thumbnail }}
              resizeMode="cover"
            />
          </Animated.View>
        </Portal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  animating: {
    transformOrigin: "0% 0%",
  },
});

export default React.memo(PhotoPreview);
```

The math is simpler than it looks. The thumbnail is square, the photo usually isn't. So we animate the height in thumbnail units, from `THUMB_SIZE` to `fullImageHeight / SCALE`, and scale the whole view by `SCALE`, using the top-left corner as the origin. At `progress` 1, the thumbnail covers exactly the rectangle where the full-res photo will be drawn.

The detail screen fades its backdrop in with `progress`, and keeps the full-res photo hidden for now (`visibility.target` is `0`):

PhotoDetail.tsx (updated)

```
import { useCallback } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StaticScreenProps } from "@react-navigation/native";

import type { Photo } from "./photos";
import { SCREEN_WIDTH } from "./constants";
import { useHeroTransition } from "./hero";

type PhotoDetailProps = StaticScreenProps<{ photo: Photo }>;

function PhotoDetail({ route }: PhotoDetailProps) {
  const { photo } = route.params;
  const { visibility } = useHeroTransition();
  const progress = useHeroTransition((s) => s.progress);
  const direction = useHeroTransition((s) => s.direction);
  const goBack = useHeroTransition((s) => s.goBack);
  const navigation = useNavigation();
  const { top: safeAreaTop } = useSafeAreaInsets();

  const fullHeight = SCREEN_WIDTH * (photo.height / photo.width);

  const onGoBack = useCallback(() => {
    goBack(navigation.goBack);
  }, [navigation, goBack]);

  const backdrop = useAnimatedStyle(
    () => ({
      opacity: direction === "neutral" ? 1 : progress.value,
    }),
    [direction],
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.backdrop, backdrop]} />
      <Image
        source={{ uri: photo.fullSize }}
        style={{
          marginTop: safeAreaTop,
          width: SCREEN_WIDTH,
          height: fullHeight,
          opacity: visibility.target,
        }}
        resizeMode="cover"
        fadeDuration={0}
      />
      <Pressable
        style={[styles.backButton, { top: safeAreaTop + 10 }]}
        onPress={onGoBack}
      >
        <Text style={styles.backText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PhotoDetail;
```

Animation transcript:

1. The detail screen opens on top, transparent. Its full-res photo is mounted but hidden: visibility.target is 0.
2. A spring drives progress from 0 to 1. The thumbnail’s translate, scale and height are interpolated from it, above every screen.
3. The animation ends on the low-res thumbnail. It’s blurry at full screen: nothing shows the full-res photo yet.

The thumbnail now flies from its cell to full screen. But look closely at the result: it's the 150 px thumbnail, stretched to the full width of the screen.

![A blurry, low-resolution photo of camera parts stretched to full screen at the end of the animation.](/react-native-teleport/pr-preview/pr-205/img/photo-gallery-transition/step5-low-res.jpg)

Close doesn't work yet

Try tapping Close: nothing happens. The thumbnail still lives in the root host, above every screen, and it covers the button. We'll fix that in step 7. Until then, reload the app to get back to the grid.

Keep animated styles attached

The animated `height` style is always attached and returns `THUMB_SIZE` when the thumbnail isn't animating. Attaching an animated style only when the animation starts can produce one frame with zero height on Android, because the first Fabric commit happens before Reanimated provides the value.

## Step 6: Hand off to the full-res photo[​](#step-6-hand-off-to-the-full-res-photo "Direct link to Step 6: Hand off to the full-res photo")

Now the most interesting part. The full-res photo starts loading as soon as the detail screen mounts, while the thumbnail is still flying. The moment it's ready, we want it on screen.

For that, the full-res `<Image>` follows **the same interpolation** as the thumbnail, at `opacity: 0`. Both images cover the same rectangle in every frame, so we can swap them at any moment. The swap itself is a single store update. Declare `targetElementAvailable` in the `HeroStore` interface and add it to the store:

<!-- -->

hero.ts (updated)

```
transitionCompleted: () => void;
targetElementAvailable: () => void;
// ...
targetElementAvailable: () => {
  // Swap visibility: hide source thumbnail, show target full-res image
  set({ visibility: { source: 0, target: 1 } });
},
```

The thumbnail takes its opacity from `visibility.source`:

<!-- -->

PhotoPreview\.tsx (updated)

```
const goForward = useHeroTransition((s) => s.goForward);
const source = useHeroTransition((s) =>
  s.id === photo.id ? s.visibility.source : 1,
);
// ...
<Animated.Image
  style={[{ width: THUMB_SIZE, opacity: source }, animatedHeight]}
  source={{ uri: photo.thumbnail }}
  resizeMode="cover"
/>
```

The detail screen animates the full-res photo along the same path and calls `targetElementAvailable` from `onLoad`:

PhotoDetail.tsx (updated)

```
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StaticScreenProps } from "@react-navigation/native";

import type { Photo } from "./photos";
import { SCALE, SCREEN_WIDTH } from "./constants";
import { useHeroTransition } from "./hero";

type PhotoDetailProps = StaticScreenProps<{ photo: Photo }>;

function PhotoDetail({ route }: PhotoDetailProps) {
  const { photo } = route.params;
  const { targetElementAvailable, visibility } = useHeroTransition();
  const progress = useHeroTransition((s) => s.progress);
  const direction = useHeroTransition((s) => s.direction);
  const position = useHeroTransition((s) => s.position);
  const goBack = useHeroTransition((s) => s.goBack);
  const navigation = useNavigation();
  const { top: safeAreaTop } = useSafeAreaInsets();

  const fullHeight = SCREEN_WIDTH * (photo.height / photo.width);

  const onLoad = useCallback(() => {
    if (useHeroTransition.getState().id === photo.id) {
      targetElementAvailable();
    }
  }, [photo.id, targetElementAvailable]);

  const onGoBack = useCallback(() => {
    goBack(navigation.goBack);
  }, [navigation, goBack]);

  const backdrop = useAnimatedStyle(
    () => ({
      opacity: direction === "neutral" ? 1 : progress.value,
    }),
    [direction],
  );

  const heroImage = useAnimatedStyle(() => {
    if (direction === "neutral" || !position) {
      return {
        width: SCREEN_WIDTH,
        height: fullHeight,
        transform: [],
      };
    }
    return {
      width: SCREEN_WIDTH,
      height: interpolate(progress.value, [0, 1], [SCREEN_WIDTH, fullHeight]),
      transform: [
        { translateX: interpolate(progress.value, [0, 1], [position.x, 0]) },
        {
          translateY: interpolate(
            progress.value,
            [0, 1],
            [position.y - safeAreaTop, 0],
          ),
        },
        { scale: interpolate(progress.value, [0, 1], [1 / SCALE, 1]) },
      ],
    };
  }, [direction, position, safeAreaTop, fullHeight]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.backdrop, backdrop]} />
      <Animated.Image
        source={{ uri: photo.fullSize }}
        style={[
          styles.heroImage,
          { marginTop: safeAreaTop, opacity: visibility.target },
          heroImage,
        ]}
        resizeMode="cover"
        fadeDuration={0}
        onLoad={onLoad}
      />
      <Pressable
        style={[styles.backButton, { top: safeAreaTop + 10 }]}
        onPress={onGoBack}
      >
        <Text style={styles.backText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
  },
  heroImage: {
    transformOrigin: "0% 0%",
  },
  backButton: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PhotoDetail;
```

Animation transcript:

1. The detail screen mounts the full-res photo, invisible. Its \<Image> sits at opacity 0 on the thumbnail’s path while it loads.
2. Both ride the same spring, but you only see the low-res one. One progress value drives translate, scale and height on both layers.
3. When onLoad fires mid-flight, one commit swaps them. set({ visibility: { source: 0, target: 1 } }) hands the image over to the detail screen in the same native frame.
4. The full-res photo finishes the animation. The hidden thumbnail keeps pace until it ends.

Now the photo turns sharp the moment it loads: mid-flight if the network is fast, right after the animation if it's slow. Both changes of the swap land in the same commit, so there's never a frame with both images hidden or both visible.

Why the swap can happen mid-flight

The thumbnail lives in the root `PortalHost` and the full-res image lives in the detail screen, but both derive their position, scale and height from the same shared `progress` value. At any moment they are pixel-aligned, so hiding one and showing the other in a single commit is invisible to the user, at any point of the animation.

Disable the fade on Android

`fadeDuration={0}` turns off Android's default image fade-in, so the photo appears in a single frame when it's swapped in.

Close still doesn't respond

The thumbnail is invisible now, but it's still in the root host, on top of the Close button. The next step takes care of it.

## Step 7: Return the thumbnail to its cell[​](#step-7-return-the-thumbnail-to-its-cell "Direct link to Step 7: Return the thumbnail to its cell")

The thumbnail has done its job. Once the animation has finished and the full-res photo is shown, we send the thumbnail back to its cell:

hero.ts (updated)

```
import {
  type SharedValue,
  makeMutable,
  runOnJS,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { create } from "zustand";
import { SPRING_CONFIG } from "./constants";

type Position = {
  x: number;
  y: number;
};

interface HeroStore {
  direction: "forward" | "backward" | "neutral";
  /** Which photo is currently animating (Portal teleport) */
  id: string;
  /** Photo that owns the hero pipeline; survives teleportBack so opacity gating works during detail + back */
  ownerId: string;
  /** Animation progress [0..1] */
  progress: SharedValue<number>;
  /** Measured position of the thumbnail before transition */
  position: Position | undefined;
  visibility: {
    /** Opacity of the source (thumbnail in grid) */
    source: number;
    /** Opacity of the target (full-res image on detail screen) */
    target: number;
  };
  set: (newState: Partial<Omit<HeroStore, "set">>) => void;
  isAnimationCompleted: boolean;
  isTargetElementAvailable: boolean;
  transitionCompleted: () => void;
  targetElementAvailable: () => void;
  goBack: (callback: () => void) => void;
  goForward: (id: string, x: number, y: number, callback: () => void) => void;
}

export const useHeroTransition = create<HeroStore>((set, get) => ({
  direction: "neutral",
  id: "",
  ownerId: "",
  position: undefined,
  visibility: { source: 1, target: 0 },
  progress: makeMutable(0),
  isAnimationCompleted: false,
  isTargetElementAvailable: false,
  set: (newState) => set((state) => ({ ...state, ...newState })),

  transitionCompleted: () => {
    set({ isAnimationCompleted: true });

    if (get().isTargetElementAvailable) {
      get().targetElementAvailable();
    }
  },

  targetElementAvailable: () => {
    set({ isTargetElementAvailable: true });

    if (!get().isAnimationCompleted) {
      // Full-res image is ready mid-flight: it follows the same animation,
      // so swap it in now and teleport back once the animation completes
      set({ visibility: { source: 0, target: 1 } });
      return;
    }

    const teleportBack = () => {
      // Wait several frames then reset — detach animated style
      // and return thumbnail to normal grid rendering
      setTimeout(() => {
        set({
          id: "",
        });
        get().progress.set(1);
      }, 48);
    };

    // Swap visibility: hide source thumbnail, show target full-res image
    set({
      direction: "neutral",
      visibility: { source: 0, target: 1 },
      isTargetElementAvailable: false,
      isAnimationCompleted: false,
    });

    // Animate progress back to 0 (instantly) to return thumbnail to grid position,
    // then detach from portal host
    setTimeout(() => {
      get().progress.set(
        withTiming(0, { duration: 0 }, () => {
          runOnJS(teleportBack)();
        }),
      );
    }, 16);
  },

  goBack: (callback: () => void) => {
    get().progress.set(0);
    set({
      direction: "neutral",
      id: "",
      ownerId: "",
      position: undefined,
      visibility: { source: 1, target: 0 },
      isAnimationCompleted: false,
      isTargetElementAvailable: false,
    });
    callback();
  },
  goForward: (id: string, x: number, y: number, callback: () => void) => {
    set({
      direction: "forward",
      position: { x, y },
      visibility: { source: 1, target: 0 },
      isAnimationCompleted: false,
      isTargetElementAvailable: false,
      id,
      ownerId: id,
    });

    const transitionCompleted = get().transitionCompleted;
    requestAnimationFrame(() => {
      get().progress.set(
        withSpring(1, SPRING_CONFIG, () => {
          runOnJS(transitionCompleted)();
        }),
      );
      callback();
    });
  },
}));
```

The animation and the photo can finish in either order:

* **Photo loads first** (during the animation): `targetElementAvailable` swaps `visibility` immediately and returns. When the spring finishes, `transitionCompleted` sees that the photo is available and finishes the handoff.
* **Animation finishes first**: `transitionCompleted` only records that fact. When the photo loads later, `targetElementAvailable` swaps `visibility` and finishes the handoff right away.

Finishing the handoff means resetting `progress` to `0` for the hidden thumbnail and clearing `id`, which teleports the thumbnail back into its cell. Then `progress` goes back to `1` for the detail screen.

Back in its cell, the thumbnail must stay hidden while the photo is open, otherwise it would flash behind the viewer. `ownerId` remembers which photo is open after `id` has been cleared:

<!-- -->

PhotoPreview\.tsx (updated)

```
const source = useHeroTransition((s) =>
  s.id === photo.id || s.ownerId === photo.id ? s.visibility.source : 1,
);
```

Animation transcript:

1. When the animation ends, the thumbnail teleports back to its cell. It stays hidden while the photo is open, and Close fades in.

Invisible doesn't mean gone

`opacity: 0` hides a view, but it still receives touches. A hidden thumbnail left in the root host would sit above every screen and swallow taps meant for the detail screen, which is exactly why Close didn't respond in steps 5 and 6. Returning the thumbnail frees the root host for the next transition too.

Close works again. It closes instantly for now; let's animate it.

## Step 8: Animate the way back[​](#step-8-animate-the-way-back "Direct link to Step 8: Animate the way back")

The way back doesn't need a teleport at all. The full-res photo is already on the detail screen, and it uses the same interpolation as on the way in. So closing is just `progress` going back to `0`: the photo shrinks into the cell where its thumbnail is waiting, hidden. When the spring finishes, the store shows the thumbnail again and `navigation.goBack()` removes the detail screen:

<!-- -->

hero.ts (updated)

```
goBack: (callback: () => void) => {
  set({ direction: "backward" });

  const onAnimationFinished = () => {
    set({
      direction: "neutral",
      id: "",
      ownerId: "",
      position: undefined,
      visibility: { source: 1, target: 0 },
      isAnimationCompleted: false,
      isTargetElementAvailable: false,
    });
    callback();
  };

  get().progress.set(
    withSpring(0, SPRING_CONFIG, () => {
      runOnJS(onAnimationFinished)();
    }),
  );
},
```

The detail screen shows the Close button only when the opening animation has finished, and the Android back button runs the same animation:

PhotoDetail.tsx (updated)

```
import { useCallback, useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StaticScreenProps } from "@react-navigation/native";

import type { Photo } from "./photos";
import { SCALE, SCREEN_WIDTH } from "./constants";
import { useHeroTransition } from "./hero";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PhotoDetailProps = StaticScreenProps<{ photo: Photo }>;

function PhotoDetail({ route }: PhotoDetailProps) {
  const { photo } = route.params;
  const { targetElementAvailable, visibility } = useHeroTransition();
  const progress = useHeroTransition((s) => s.progress);
  const direction = useHeroTransition((s) => s.direction);
  const position = useHeroTransition((s) => s.position);
  const goBack = useHeroTransition((s) => s.goBack);
  const navigation = useNavigation();
  const { top: safeAreaTop } = useSafeAreaInsets();

  const fullHeight = SCREEN_WIDTH * (photo.height / photo.width);

  const isTransitionDone = visibility.target === 1 && direction !== "forward";
  const buttonOpacity = useSharedValue(0);

  const onLoad = useCallback(() => {
    if (useHeroTransition.getState().id === photo.id) {
      targetElementAvailable();
    }
  }, [photo.id, targetElementAvailable]);

  const onGoBack = useCallback(() => {
    goBack(navigation.goBack);

    return true;
  }, [navigation, goBack]);

  useEffect(() => {
    buttonOpacity.value = withTiming(isTransitionDone ? 1 : 0, {
      duration: 200,
    });
  }, [isTransitionDone, buttonOpacity]);

  useEffect(() => {
    const listener = BackHandler.addEventListener(
      "hardwareBackPress",
      onGoBack,
    );
    return () => listener.remove();
  }, [onGoBack]);

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));
  const backdrop = useAnimatedStyle(
    () => ({
      opacity: direction === "neutral" ? 1 : progress.value,
    }),
    [direction],
  );

  const heroImage = useAnimatedStyle(() => {
    if (direction === "neutral" || !position) {
      return {
        width: SCREEN_WIDTH,
        height: fullHeight,
        transform: [],
      };
    }
    return {
      width: SCREEN_WIDTH,
      height: interpolate(progress.value, [0, 1], [SCREEN_WIDTH, fullHeight]),
      transform: [
        { translateX: interpolate(progress.value, [0, 1], [position.x, 0]) },
        {
          translateY: interpolate(
            progress.value,
            [0, 1],
            [position.y - safeAreaTop, 0],
          ),
        },
        { scale: interpolate(progress.value, [0, 1], [1 / SCALE, 1]) },
      ],
    };
  }, [direction, position, safeAreaTop, fullHeight]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.backdrop, backdrop]} />
      <Animated.Image
        source={{ uri: photo.fullSize }}
        style={[
          styles.heroImage,
          { marginTop: safeAreaTop, opacity: visibility.target },
          heroImage,
        ]}
        resizeMode="cover"
        fadeDuration={0}
        onLoad={onLoad}
      />
      <AnimatedPressable
        style={[styles.backButton, { top: safeAreaTop + 10 }, buttonStyle]}
        onPress={onGoBack}
        disabled={!isTransitionDone}
      >
        <Text style={styles.backText}>Close</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
  },
  heroImage: {
    transformOrigin: "0% 0%",
  },
  backButton: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PhotoDetail;
```

Animation transcript:

1. Close runs the same interpolation in reverse. goBack springs progress back to 0, and the full-res photo shrinks into the cell on the detail screen.
2. Then the thumbnail shows up and the detail screen closes. visibility goes back to { source: 1, target: 0 }, and navigation.goBack() removes the screen.

Why does Close wait for the opening animation?

Closing earlier would interrupt the spring whose completion callback finishes the handoff. Hiding and disabling the button until then keeps the two animations from overlapping.

That's the whole transition. Run the app, tap a photo, and you should see the result from the video at the top of this page.

## The full pipeline[​](#the-full-pipeline "Direct link to The full pipeline")

Here are all the steps together: teleport, animation, handoff, return and the way back. Use the timeline to inspect any moment, and watch the store values below it change.

Animation transcript:

1. The gallery: a FlatList of low-res thumbnails. A PortalHost “root” waits above the navigator.
2. Every thumbnail is wrapped in a \<Portal>. Without a host name, it renders in place, inside the FlatList.
3. Tap teleports the thumbnail into the root PortalHost. \<Portal hostName="root"> re-parents the same native view, in one frame.
4. The detail screen mounts the full-res photo, invisible. Its \<Image> sits at opacity 0 on the thumbnail’s path while it loads.
5. Both ride the same spring, but you only see the low-res one. One progress value drives translate, scale and height on both layers.
6. When onLoad fires mid-flight, one commit swaps them. set({ visibility: { source: 0, target: 1 } }) hands the image over to the detail screen in the same native frame.
7. The full-res photo finishes the animation. The hidden thumbnail keeps pace until it ends.
8. When the animation ends, the thumbnail teleports back to its cell. It stays hidden while the photo is open, and Close fades in.
9. Close runs the same interpolation in reverse. goBack springs progress back to 0, and the full-res photo shrinks into the cell on the detail screen.
10. Then the thumbnail shows up and the detail screen closes. visibility goes back to { source: 1, target: 0 }, and navigation.goBack() removes the screen.
11. What users see: one continuous image, sharp as soon as it’s ready. No flicker, no blank frames, no second decode of the full-res photo.

The complete code of this guide is part of the example app: [`example/src/screens/PhotoGallery`](https://github.com/kirillzyusko/react-native-teleport/tree/main/example/src/screens/PhotoGallery) and [`example/src/hooks/useMeasure.ts`](https://github.com/kirillzyusko/react-native-teleport/blob/main/example/src/hooks/useMeasure.ts). The only differences are the imports that wire the screens into the example's navigation.

## Going further: videos, GIFs and other stateful content[​](#going-further-videos-gifs-and-other-stateful-content "Direct link to Going further: videos, GIFs and other stateful content")

`<Portal>` doesn't render a copy of the thumbnail: it moves the existing native view between parents. Whatever runs inside that view keeps running during the transition:

* a video keeps playing while it grows to full screen, with no restart and no black frame;
* a GIF or Lottie animation continues from the same frame;
* any other native state, such as a scroll position or a WebView, is preserved.

For media that loads progressively, apply the same handoff as in this guide: show the cheap version (a poster image or a low-bitrate stream) inside the portal, render the expensive version on the detail screen along the same path, and swap them when the expensive one reports that it's ready, for example `onLoad` for images or `onReadyForDisplay` for `react-native-video`. The [Instagram-like transitions](/react-native-teleport/pr-preview/pr-205/docs/recipes/instagram-shared-transitions.md) recipe shows a video teleported between a feed and a full-screen viewer while it keeps playing.

## Where to use this pattern[​](#where-to-use-this-pattern "Direct link to Where to use this pattern")

* **Chat apps.** Tapping an image or video attachment in a message bubble opens it full screen from the bubble's exact position, and closing returns it to the bubble.
* **Social feeds.** Posts with several images (as on Facebook, X or in Instagram carousels) can open any image from its tile. Use an id that is unique per attachment, such as `postId` plus the image index, so only the tapped tile teleports.
* **Photo galleries and e-commerce.** Product images, albums and media pickers share the same thumbnail-to-full-screen flow.

In every case the list keeps rendering lightweight thumbnails, and the expensive media is loaded only for the item the user opens.

## Common pitfalls[​](#common-pitfalls "Direct link to Common pitfalls")

* **Content jumps at the swap.** The thumbnail and the full-res image must have the same aspect ratio and the same `resizeMode`, otherwise they crop different parts of the photo.
* **Blank frame on Android when the animation starts.** Keep animated styles attached for the component's whole lifetime instead of adding them when the animation begins.
* **The photo fades in instead of swapping.** Set `fadeDuration={0}` on the full-res `<Image>` on Android.
* **Taps don't reach the detail screen.** A hidden view in the root host still receives touches. Return the thumbnail to its cell once the full-res photo is shown.
* **The thumbnail flashes in the grid behind the viewer.** Keep it hidden while the viewer is open: in this guide `ownerId` keeps `visibility.source` applied to the thumbnail after it has been teleported back.
* **Wrong start position on Android.** With edge-to-edge enabled, `measureInWindow` can be offset by the status bar height. `useMeasure` compensates for it.

## FAQ[​](#faq "Direct link to FAQ")

**Is the full-res photo downloaded or rendered twice?** No. Only the detail screen renders the full-res `<Image>`. The thumbnail that flies across the screen is the original grid view, moved by `<Portal>`.

**What happens if the full-res photo loads after the animation ends?** The low-res thumbnail stays on screen in the final position until `onLoad` fires, then the same single-commit swap shows the photo.

**What if the photo is already cached?** `onLoad` fires almost immediately, and the swap happens at the very beginning of the animation.

**Does this require a custom image cache or prefetching?** No. The guide uses the standard React Native `<Image>`. You can add caching on top, but the transition doesn't depend on it.

**Can I use another image component?** Yes, as long as it reports when the image is ready (an `onLoad`-style callback) and supports `cover` cropping, the handoff works the same way.

**Which platforms are supported?** `react-native-teleport` supports iOS, Android and web. This transition was verified frame by frame on iOS and Android with the New Architecture.

## Photo credits[​](#photo-credits "Direct link to Photo credits")

<!-- -->

The photos are from [Unsplash](https://unsplash.com), served by [Lorem Picsum](https://picsum.photos), by Paul Jarvis ([1](https://unsplash.com/photos/6J--NXulQCs), [2](https://unsplash.com/photos/NYDo21ssGao)), [Aleks Dorohovich](https://unsplash.com/photos/nJdwUHmaY8A), [Alejandro Escamilla](https://unsplash.com/photos/Iuq0EL4EINY), [Go Wild](https://unsplash.com/photos/V0yAek6BgGk), [Vadim Sherbakov](https://unsplash.com/photos/osSryggkso4), [Luke Chesser](https://unsplash.com/photos/KR2mdHJ5qMg), [Margaret Barley](https://unsplash.com/photos/Qo51KwK1dKg), [Nicholas Swanson](https://unsplash.com/photos/d19by2PLaPc), [Tony Naccarato](https://unsplash.com/photos/-kEr-QltARg), [Jassy Onyae](https://unsplash.com/photos/1gBUXhf0PtA) and [Alexander Shustov](https://unsplash.com/photos/OxzhYtL-00Y).
