import { render, screen, waitFor } from "@testing-library/react-native";
import { useContext } from "react";
import { Text } from "react-native";

import Portal from "../components/Portal";
import PortalHost from "../components/PortalHost";
import ScrollViewContext from "../contexts/ScrollViewContext";
import PortalProvider from "../PortalProvider";

function ScrollViewContextMarker() {
  const context = useContext(ScrollViewContext);
  const label = context
    ? context.horizontal
      ? "horizontal"
      : "vertical"
    : "none";

  return <Text>{label}</Text>;
}

describe("`Portal` ScrollView context", () => {
  it("uses destination host context when the portal is teleported", async () => {
    render(
      <PortalProvider>
        <ScrollViewContext.Provider value={{ horizontal: true }}>
          <PortalHost name="destination" />
        </ScrollViewContext.Provider>
        <ScrollViewContext.Provider value={{ horizontal: false }}>
          <Portal hostName="destination">
            <ScrollViewContextMarker />
          </Portal>
        </ScrollViewContext.Provider>
      </PortalProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("horizontal")).toBeOnTheScreen();
    });
    expect(screen.queryByText("vertical")).not.toBeOnTheScreen();
  });

  it("keeps source context when the destination host is unavailable", () => {
    render(
      <PortalProvider>
        <ScrollViewContext.Provider value={{ horizontal: false }}>
          <Portal hostName="missing">
            <ScrollViewContextMarker />
          </Portal>
        </ScrollViewContext.Provider>
      </PortalProvider>,
    );

    expect(screen.getByText("vertical")).toBeOnTheScreen();
  });
});
