# Intro

## What is the portal?[​](#what-is-the-portal "Direct link to What is the portal?")

A **Portal** lets you render a component somewhere else in the UI tree, while keeping it logically inside its parent.<br /><!-- -->Typical use cases include **modals**, **tooltips**, **popovers**, and other overlays where the visual position differs from the React tree position.

On the web this is done with [`createPortal`](https://react.dev/reference/react-dom/createPortal), but React Native has no built-in solution ([issue #36273](https://github.com/facebook/react-native/issues/36273)).

## Existing solutions (and their limits)[​](#existing-solutions-and-their-limits "Direct link to Existing solutions (and their limits)")

Community libraries like [@gorhom/portal](https://github.com/gorhom/react-native-portal) or [react-gateway](https://github.com/cloudflare/react-gateway) emulate portals in **JavaScript**. They work, but:

❌ Components are **re-parented in JS**, not in the actual native view tree.<br /><!-- -->❌ This can break or block access to **React Context** values (theme, navigation, i18n, etc.).<br /><!-- -->❌ Rendering is still bound to the JS layer, which can limit **performance** and **platform-native behaviors**.

## Introducing `react-native-teleport`[​](#introducing-react-native-teleport "Direct link to introducing-react-native-teleport")

This library brings **true native portals** to React Native:

✅ The component stays in the **original React tree** → contexts & state are preserved.<br /><!-- -->✅ The view is physically moved in the **native view hierarchy** → correct layout, z-order & performance.<br /><!-- -->✅ Works across **iOS, Android, and Web**.<br /><!-- -->✅ Supports not only portals but also **re-parenting (teleport)**: move an existing view without unmounting it.

You can think of it as:

> **"Teleport your view in native space, without breaking React logic."**

## Comparison[​](#comparison "Direct link to Comparison")

|                                                         | `react-native-teleport` | `@gorhom/portal` |
| ------------------------------------------------------- | ----------------------- | ---------------- |
| Render local component in a different place in the tree | ✅                      | ✅               |
| Support multiple hosts/portals                          | ✅                      | ✅               |
| Native implementation                                   | ✅                      | ❌               |
| Keeps React tree continuity                             | ✅                      | ❌               |
| Preserves React context                                 | ✅                      | ❌               |
| Move views without losing state (teleport)              | ✅                      | ❌               |
| Mirroring 1                                             | 🟠 2                    | ❌               |

> 1 create a live copy of a view elsewhere in the tree (similar to a real-time snapshot).

> 2 Is planned to be added in the future

***

## Next steps[​](#next-steps "Direct link to Next steps")

Ready to get started? 🚀 Head over to the [Installation](/react-native-teleport/pr-preview/pr-91/docs/installation.md) guide.
