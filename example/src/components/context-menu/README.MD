# Context menu documentation

## Before we start

To speak on the same language let's define the terminology first:

- ContextMenu - UI element similar to a native one on iOS.
- Portal - An element, that transfers children to root level (for that we are using `@gorhom/portal` library, it re-mounts JS elements, so internal state of the component will be reset).
- Teleport - An element, that transfers children to root level but do it in a native thread without re-mounting element in ReactJS.
- Pan - context provider that uses `PanGestureHandler` from `react-native-gesture-handler` and broadcasting events (finger sliding implemented using this concept).
- Elements - any UI element that can be displayed inside of `ContextMenu`. Have a look on `elements` folder.
- Anchor - an element that serves as an "anchor" for the context menu. From here, the menu will appear and disappear.

### Why not to use open source/native component?

All open sources are not satisfying to app requirements:

- [react-native-context-menu-view](https://github.com/mpiannucci/react-native-context-menu-view) - has a limited customization (we can not use `lottie`, we can not customize icons and we forced to use Apple system icons);
- [react-native-hold-menu](https://github.com/enesozturk/react-native-hold-menu) - not precise replica (menu is not animating it's height), children gets re-mounted during "teleportation", tough binding with `expo` modules, not supporting "finger sliding", lack of customization (you can't put any child into menu), tha package looks slightly abandoned.

## Design concept (user perspective)

Taking everything above into consideration we decided to write our own replica. The reason for creating a replica (instead of native code) is because we wanted to be able to allow everyone on the team to edit the code (even though the code is quite complex due to the math calculations, I still believe that it can be maintained by any member of the team and this documentation has been created to get familiar with the code as quickly as possible 😊).

From a user (developer, who uses this UI element - not develop it) everything begins from `ContextMenu`. It's a root component, which accepts two children:

- `ContextMenu.Anchor`;
- `ContextMenu.Options`.

That's the original concept which wasn't changed from the first commit. Also one important aspect, is that `ContextMenu`, `ContextMenu.Anchor` and `ContextMenu.Options` are independent from each other (for example opening of menu shouldn't depend on `ContextMenu.Anchor` - we should deliver simple API, which can be adopted for each use case and open it by different event, such as onPress/onLongPress/onSwipe/onScroll/etc.).

Another important aspect is that `ContextMenu` shouldn't know anything about `Animated`/`Reanimated`. It should act as a provider and assure lazy initialization of animated values in order to reduce memory consumption.

## Design concept (developer perspective)

Let's dig into how it works. The process of appearance can be divided into 3 stages.

### Stage 1 (anchor position calculation)

`ContextMenu` is wrapping `ContextMenu.Anchor` in additional `View` and assigns internal `ref`. When we call `contextMenuRef.current?.open()` internally first of all we calculate position of anchor relative to the screen (`viewRef.current?.measure`). After that we store the information about layout in `ref`.

Next step we are calculating `top`, `left`, `height` properties (if anchor is teleportable) and store it in `destination` SharedValue (which is located in `TeleportProvider`). All these fields are used to properly animate the movement of the anchor if it's teleportable. When SharedValue is updated, we are toggling state (`setVisible(true)`) in order to mount `AnimatedPopup`.

### Stage 2 (animate popup layout calculation)

Once this popup has been mounted it displays in root and shown offscreen (we are waiting for `onLayout` to capture final popup layout).

> Ideally it would be good to perform it through `useAnimatedRef`+`measure`, which works synchronously on UI thread, but as of reanimated 2.8.0 it was broken and we calculate it in canonical way.

Once we get info about layout -> we are calculating additional information, such as "anchor point", vertical movement (if popup goes beyond screen border). Part of the information is saved in local shared value, part is saved in `TeleportProvider` context.

On this stage we've calculated all necessary info and can proceed to animation through `progress.value = withSpring(1, ...);`.

1. Please note, that all popup animation styles should be incapsulated in `AnimatedPopup`.
2. Note, that `progress` came from `TeleportProvider` context. It's because we are using one value as a driver of the animation (it always should be one, other styles should be calculated through `interpolation`). Just theoretically this value could live in `ContextMenu`, but we noticed, that the usage of `useSharedValue` can cause crashes, if component gets mounted/unmounted often (for example in list with virtualizations), so we decided to have a singe value across app, since it consumes less memory and potentially prevents crashes and as of now we can have only single `ContextMenu` opened on a screen.

### Stage 2.1 (view teleportation)

If view is `teleportable`, then before mounting we are doing one additional step - we are calculating view layout and save it in TeleportProvider (`destination`) shared value. Teleport view acts as a cutout area - it truncates all invisible part of the anchor and animates it later. You may think about it as "shared element transition" with a lot of manual hand engineering.

### Stage 3 (animation)

Honestly, it's quite complicated animation (`AnimatedPopup`), since we are animating many properties (`height`, `translate`, `left`, `opacity`, etc.). I've tried to keep transformations simple. In case if you don't understand all transformation as a single thing - try to comment out the code and see, how it behaves after your changes. I believe such way can get you familiar with styles transformation faster.
