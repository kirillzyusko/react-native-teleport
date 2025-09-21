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
