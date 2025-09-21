---
sidebar_position: 1
description: A testing-guide showing how to write unit-tests using jest
keywords: [react-native-teleport, jest, mock, testing]
---

# Jest testing guide

## Setting up a mock

This library includes a built in mock for Jest. To use it, add the following code to the [jest setup](https://jestjs.io/docs/configuration#setupfiles-array) file:

```js
jest.mock("react-native-teleport", () => require("react-native-teleport/jest"));
```

## Test case example

Once you've set up mock - you can write your first test 😊. A sample of test case is shown below. For more test cases please see [this](https://github.com/kirillzyusko/react-native-teleport/tree/main/example/__tests__) link.

```tsx
import { render, screen } from "@testing-library/react-native";

import { View } from "react-native";

import { PortalProvider, PortalHost, Portal } from "react-native-teleport";

function TestComponent() {
  return (
    <PortalProvider>
      <PortalHost name="app" />
      <View>
        <Portal hostName="app" name="modal">
          <View />
        </Portal>
      </View>
    </PortalProvider>
  );
}

describe("portal rendering", () => {
  it("should render without errors", () => {
    render(<TestComponent />);

    expect(screen.toJSON()).toMatchSnapshot();
  });
});
```
