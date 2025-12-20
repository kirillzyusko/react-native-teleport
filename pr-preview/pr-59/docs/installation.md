# Installation

## Adding a library to the project[​](#adding-a-library-to-the-project "Direct link to Adding a library to the project")

New Architecture only

This library is compatible **only** with the **new (Fabric)** architecture.

Install the `react-native-teleport` package in your React Native project.

* YARN
* NPM
* EXPO

```
yarn add react-native-teleport
```

```
npm install react-native-teleport --save
```

```
npx expo install react-native-teleport
```

Only Expo Dev client compatible

This library has native code, so it **does not work** with *Expo Go* but it's fully compatible with [custom dev client](https://docs.expo.dev/development/getting-started/).

### Linking[​](#linking "Direct link to Linking")

This package supports [autolinking](https://github.com/react-native-community/cli/blob/master/docs/autolinking.md).

Pods update

After adding the package don't forget to **re-install** `pods` and **re-assemble** `android` and `ios` applications, since this library contains native code.

If you still experience issues like **package doesn't seem to be linked** try performing a fresh build to clear any outdated cache.

## Adding provider[​](#adding-provider "Direct link to Adding provider")

In order to use it you'll need to wrap your app with `PortalProvider` component.

```
import { PortalProvider } from "react-native-teleport";

export default function App() {
  return (
    <PortalProvider>
      {/* your main application code goes here */}
    </PortalProvider>
  );
}
```

Congratulations! 🎉 You've just finished installation process. Go to the [next section](/react-native-teleport/pr-preview/pr-59/docs/guides/portal.md) to get more insights of what you can do using this library. 😎
