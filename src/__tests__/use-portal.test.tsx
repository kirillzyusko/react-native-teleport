import { fireEvent, render, screen } from "@testing-library/react-native";

import { Button, View, StyleSheet } from "react-native";
import Portal from "../components/Portal";
import PortalHost from "../components/PortalHost";
import { useState } from "react";
import usePortal from "../hooks/usePortal";
import PortalProvider from "../PortalProvider";

function Hook() {
  const [_, setN] = useState(0);
  const [shouldShowSecondPortal, setShowSecondPortal] = useState(false);
  const { removePortal } = usePortal("local");

  return (
    <>
      <View style={styles.absolute}>
        <PortalHost name="local" />
      </View>
      <View style={styles.container}>
        <Portal hostName={"local"} name="portal">
          <View style={styles.box} testID="portal-1" />
        </Portal>
        {shouldShowSecondPortal && (
          <Portal hostName={"local"} name="portal">
            <View style={styles.box} testID="portal-2" />
          </Portal>
        )}
        <Button title="Force re-render" onPress={() => setN((n) => n + 1)} />
        <Button title="Remove" onPress={() => removePortal("portal")} />
        <Button
          title={
            shouldShowSecondPortal ? "Hide second portal" : "Show second portal"
          }
          onPress={() => setShowSecondPortal((t) => !t)}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    width: 160,
    height: 160,
    marginVertical: 20,
    backgroundColor: "blue",
  },
  absolute: {
    position: "absolute",
  },
  wrapper: {
    flex: 0,
  },
});

describe("`usePortal` functional spec", () => {
  it("should remove portal when remove clicked", () => {
    render(
      <PortalProvider>
        <Hook />
      </PortalProvider>,
    );
    expect(screen.getByTestId("portal-1")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Remove"));
    expect(screen.queryByTestId("portal-1")).not.toBeOnTheScreen();
  });

  it("re-renders shouldn't restore portal after imperative removal", () => {
    render(
      <PortalProvider>
        <Hook />
      </PortalProvider>,
    );
    expect(screen.getByTestId("portal-1")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Remove"));
    expect(screen.queryByTestId("portal-1")).not.toBeOnTheScreen();
    fireEvent.press(screen.getByText("Force re-render"));
    expect(screen.queryByTestId("portal-1")).not.toBeOnTheScreen();
  });

  it("removal should be idempotent", () => {
    render(
      <PortalProvider>
        <Hook />
      </PortalProvider>,
    );
    expect(screen.getByTestId("portal-1")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Remove"));
    expect(screen.queryByTestId("portal-1")).not.toBeOnTheScreen();
    fireEvent.press(screen.getByText("Remove"));
    expect(screen.queryByTestId("portal-1")).not.toBeOnTheScreen();
  });

  it("removal shouldn't prevent new portal from being added", async () => {
    render(
      <PortalProvider>
        <Hook />
      </PortalProvider>,
    );
    expect(screen.getByTestId("portal-1")).toBeOnTheScreen();
    expect(screen.queryByTestId("portal-2")).not.toBeOnTheScreen();
    fireEvent.press(screen.getByText("Remove"));
    expect(screen.queryByTestId("portal-1")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("portal-2")).not.toBeOnTheScreen();
    fireEvent.press(screen.getByText("Show second portal"));
    expect(screen.queryByTestId("portal-1")).not.toBeOnTheScreen();
    expect(screen.getByTestId("portal-2")).toBeOnTheScreen();
  });

  it("removes multiple instances with the same name", () => {
    render(
      <PortalProvider>
        <Hook />
      </PortalProvider>,
    );
    fireEvent.press(screen.getByText("Show second portal"));
    expect(screen.getByTestId("portal-1")).toBeOnTheScreen();
    expect(screen.getByTestId("portal-2")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Remove"));
    expect(screen.queryByTestId("portal-1")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("portal-2")).not.toBeOnTheScreen();
  });
});

function IsHostAvailableHook() {
  const [showHost, setShowHost] = useState(true);
  const { isHostAvailable } = usePortal("dynamic");

  return (
    <>
      {showHost && <PortalHost name="dynamic" />}
      <View testID="status">
        {isHostAvailable ? (
          <View testID="available" />
        ) : (
          <View testID="unavailable" />
        )}
      </View>
      <Button title="Toggle host" onPress={() => setShowHost((v) => !v)} />
    </>
  );
}

describe("`usePortal` isHostAvailable", () => {
  it("should return true when host is mounted", () => {
    render(
      <PortalProvider>
        <IsHostAvailableHook />
      </PortalProvider>,
    );
    expect(screen.getByTestId("available")).toBeOnTheScreen();
  });

  it("should return false when host is unmounted", () => {
    render(
      <PortalProvider>
        <IsHostAvailableHook />
      </PortalProvider>,
    );
    expect(screen.getByTestId("available")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Toggle host"));
    expect(screen.getByTestId("unavailable")).toBeOnTheScreen();
  });

  it("should return true again when host is remounted", () => {
    render(
      <PortalProvider>
        <IsHostAvailableHook />
      </PortalProvider>,
    );
    fireEvent.press(screen.getByText("Toggle host"));
    expect(screen.getByTestId("unavailable")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Toggle host"));
    expect(screen.getByTestId("available")).toBeOnTheScreen();
  });

  it("should return false for a host that was never mounted", () => {
    function NoHost() {
      const { isHostAvailable } = usePortal("nonexistent");

      return isHostAvailable ? (
        <View testID="available" />
      ) : (
        <View testID="unavailable" />
      );
    }

    render(
      <PortalProvider>
        <NoHost />
      </PortalProvider>,
    );
    expect(screen.getByTestId("unavailable")).toBeOnTheScreen();
  });

  it("should return true for the default root host", () => {
    function RootHost() {
      const { isHostAvailable } = usePortal();

      return isHostAvailable ? (
        <View testID="available" />
      ) : (
        <View testID="unavailable" />
      );
    }

    render(
      <PortalProvider>
        <RootHost />
      </PortalProvider>,
    );
    expect(screen.getByTestId("available")).toBeOnTheScreen();
  });
});
