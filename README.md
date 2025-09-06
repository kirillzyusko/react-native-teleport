# react-native-teleport

Missing native portal implementation for react-native

## Key features

- 🚀 Supports iOS, Android and Web
- 🎉 Zero dependencies
- 💪 Written in TypeScript
- 🧬 Supports new architectures
- ✨ Acts as portal and teleport
- 🕳️ Native view teleportation
- 🪞 Mirror support (in future)

## Installation

```sh
npm install react-native-teleport
```

## Usage

First of all, you need to add `PortalProvider` to your root component - this is usually `App.tsx`:

```tsx
import {PortalProvider} from "react-native-teleport";

export const App = () => (
  <PortalProvider>
    {/* your app goes here */}
  </PortalProvider>
);
```

Then wrap the content that you want to teleport with `Portal`:

```tsx
import {Portal} from "react-native-teleport";

export const App = () => (
  <Portal name="root">
    <View style={{backgroundColor: "red"}}>
      <Text>Hello, world!</Text>
    </View>
  </Portal>
);

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT
