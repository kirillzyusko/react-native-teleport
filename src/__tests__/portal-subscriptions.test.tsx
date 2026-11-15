import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Button, Text } from "react-native";

import Portal from "../components/Portal";
import PortalHost from "../components/PortalHost";
import usePortal from "../hooks/usePortal";
import PortalProvider from "../PortalProvider";
import PortalView from "../views/Portal";
import PortalHostView from "../views/PortalHost";

jest.mock("../views/Portal", () => jest.fn(() => null));
jest.mock("../views/PortalHost", () => jest.fn(() => null));

it("mounts a new host without re-rendering unrelated portals, hosts or observers", () => {
  function ToggleHost() {
    const [mounted, setMounted] = useState(false);
    return (
      <>
        <Button title="Toggle" onPress={() => setMounted(!mounted)} />
        {mounted && <PortalHost name="detail" />}
      </>
    );
  }

  const Observer = jest.fn(function HostObserver() {
    const { isHostAvailable } = usePortal("list");
    return <Text>{String(isHostAvailable)}</Text>;
  });

  render(
    <PortalProvider>
      <PortalHost name="list" />
      <Portal name="home" />
      <Portal hostName="list" name="item" />
      <Observer />
      <ToggleHost />
    </PortalProvider>,
  );
  expect(screen.getByText("true")).toBeOnTheScreen();
  jest.clearAllMocks();

  fireEvent.press(screen.getByText("Toggle"));
  fireEvent.press(screen.getByText("Toggle"));

  expect(PortalView).not.toHaveBeenCalled();
  expect(Observer).not.toHaveBeenCalled();
  expect(
    jest.mocked(PortalHostView).mock.calls.map(([props]) => props.name),
  ).toEqual(["detail"]);
});
