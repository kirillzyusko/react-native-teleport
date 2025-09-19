# Intro

## What is the portal?[​](#what-is-the-portal "Direct link to What is the portal?")

A **Portal** is a React concept that lets you render a component in a different place in the UI tree, while keeping it logically connected to its parent.

On the web, this is typically done with [`createPortal`](https://react.dev/reference/react-dom/createPortal).

Portals are commonly used for UI elements such as:

* Modals
* Tooltips
* Popovers
* Floating views

These are cases where the visual position of a component differs from its logical position in the React tree.

***

## Why another portal library for `react-native`?[​](#why-another-portal-library-for-react-native "Direct link to why-another-portal-library-for-react-native")

React Native does **not yet provide** a built-in `Portal` implementation ([issue #36273](https://github.com/facebook/react-native/issues/36273)).<br /><!-- -->Existing community libraries, such as [@gorhom/portal](https://github.com/gorhom/react-native-portal) or [react-gateway](https://github.com/cloudflare/react-gateway), solve this with **JavaScript-based portals**. They work well for many scenarios but come with important trade-offs:

❌ Components are **re-parented in JS**, not in the actual native view tree.<br /><!-- -->❌ This can break or block access to **React Context** values (theme, navigation, i18n, etc.).<br /><!-- -->❌ Rendering is still bound to the JS layer, which can limit **performance** and **platform-native behaviors**.

***

## Introducing `react-native-teleport`[​](#introducing-react-native-teleport "Direct link to introducing-react-native-teleport")

This library brings **true native portals** into React Native by teleportation views at the native layer (iOS/Android/web).

✅ The component stays in the **original React tree**, preserving contexts and state.<br /><!-- -->✅ The view is physically moved in the **native view hierarchy**, so layout, z-order, and performance behave like any other native view.<br /><!-- -->✅ Works seamlessly across **iOS, Android, and Web**.

You can think of it as:

> **"Teleport your view in native space, without breaking React logic."**

## Why native portals matter[​](#why-native-portals-matter "Direct link to Why native portals matter")

In native development, portals are widely used to implement flexible UI patterns. Bringing them to React Native fills a long-standing gap:

* **Re-parenting without losing state** → teleport a view while keeping its internal state intact.
* **Mirroring support** → create a live copy of a view elsewhere in the tree (similar to a real-time snapshot).
* **Powerful composition** → enable UI patterns that were previously difficult or impossible with JS-only portals.

***

## Next steps[​](#next-steps "Direct link to Next steps")

Ready to get started? 🚀 Head over to the [Installation](/react-native-teleport/pr-preview/pr-12/docs/installation.md) guide.
