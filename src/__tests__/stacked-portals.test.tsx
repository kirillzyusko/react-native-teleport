import { fireEvent, render, screen } from "@testing-library/react-native";
import { StrictMode, Suspense, useState } from "react";
import { Pressable, Text } from "react-native";
import Portal from "../components/Portal";
import PortalHost from "../components/PortalHost";
import PortalProvider from "../PortalProvider";
import NativePortal from "../specs/PortalViewNativeComponent";
import NativeHost from "../specs/PortalHostViewNativeComponent";
import useMountOrder from "../hooks/useMountOrder";

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Pressable onPress={() => setCount((value) => value + 1)}>
      <Text>Count {count}</Text>
    </Pressable>
  );
}

function Example({ order }: { order: number }) {
  return (
    <PortalProvider>
      <PortalHost name="dialogs" fullScreen />
      <Portal hostName="dialogs" name="first" stackOrder={order}>
        <Counter />
      </Portal>
      <Portal hostName="dialogs" name="second" stackOrder={2}>
        <Text>Second dialog</Text>
      </Portal>
    </PortalProvider>
  );
}

it("preserves the mounted dialog state when changing its stacking order", () => {
  const { rerender } = render(<Example order={1} />);
  fireEvent.press(screen.getByText("Count 0"));
  rerender(<Example order={3} />);
  expect(screen.getByText("Count 1")).toBeOnTheScreen();
  expect(screen.getByText("Second dialog")).toBeOnTheScreen();
  const portals = screen.UNSAFE_getAllByType(NativePortal);
  expect(portals.map((portal) => portal.props.stackOrder)).toEqual([3, 2]);
});

it("makes only the requested host full-screen", () => {
  render(<Example order={1} />);
  const hosts = screen.UNSAFE_getAllByType(NativeHost);
  expect(
    hosts.find((host) => host.props.name === "dialogs")?.props.fullScreen,
  ).toBe(true);
  expect(
    hosts.find((host) => host.props.name === "root")?.props.fullScreen,
  ).toBeUndefined();
});

function AutomaticExample({
  second,
  first = true,
}: {
  second: boolean;
  first?: boolean;
}) {
  return (
    <PortalProvider>
      <PortalHost name="dialogs" fullScreen />
      {/* Source-tree order deliberately differs from the order of opening. */}
      {second ? (
        <Portal hostName="dialogs" name="second">
          <Text>Second</Text>
        </Portal>
      ) : null}
      {first ? (
        <Portal hostName="dialogs" name="first">
          <Counter />
        </Portal>
      ) : null}
    </PortalProvider>
  );
}

it("orders later openings above earlier ones and keeps that order across rerenders", () => {
  const { rerender } = render(<AutomaticExample second={false} />);
  fireEvent.press(screen.getByText("Count 0"));
  const firstOrder = screen.UNSAFE_getByType(NativePortal).props.mountOrder;
  rerender(<AutomaticExample second />);
  const orders = Object.fromEntries(
    screen
      .UNSAFE_getAllByType(NativePortal)
      .map((portal) => [portal.props.name, portal.props.mountOrder]),
  );
  expect(orders.first).toBe(firstOrder);
  expect(orders.second).toBeGreaterThan(firstOrder);
  rerender(<AutomaticExample second />);
  expect(
    screen
      .UNSAFE_getAllByType(NativePortal)
      .map((portal) => portal.props.mountOrder),
  ).toEqual([orders.second, orders.first]);
  rerender(<AutomaticExample second={false} />);
  expect(screen.getByText("Count 1")).toBeOnTheScreen();
});

it("gives a reopened Portal a new position above the still-open Portal", () => {
  const { rerender } = render(<AutomaticExample second />);
  const oldOrder = screen
    .UNSAFE_getAllByType(NativePortal)
    .find((portal) => portal.props.name === "first")?.props.mountOrder;
  rerender(<AutomaticExample second first={false} />);
  rerender(<AutomaticExample second />);
  const portals = screen.UNSAFE_getAllByType(NativePortal);
  const first = portals.find((portal) => portal.props.name === "first");
  const second = portals.find((portal) => portal.props.name === "second");
  expect(first?.props.mountOrder).toBeGreaterThan(oldOrder);
  expect(first?.props.mountOrder).toBeGreaterThan(second?.props.mountOrder);
});

it("keeps committed opening order stable when Strict Mode replays effects", () => {
  const { rerender } = render(
    <StrictMode>
      <Example order={1} />
    </StrictMode>,
  );
  const orders = screen
    .UNSAFE_getAllByType(NativePortal)
    .map((portal) => portal.props.mountOrder);
  expect(orders.every((order) => order > 0)).toBe(true);
  expect(new Set(orders).size).toBe(orders.length);
  rerender(
    <StrictMode>
      <Example order={3} />
    </StrictMode>,
  );
  expect(
    screen
      .UNSAFE_getAllByType(NativePortal)
      .map((portal) => portal.props.mountOrder),
  ).toEqual(orders);
});

const neverResolves = new Promise<void>(() => {});

function OrderMarker({
  name,
  ready = true,
}: {
  name: string;
  ready?: boolean;
}) {
  const order = useMountOrder();
  if (!ready) throw neverResolves;
  return <Text testID={name}>{order}</Text>;
}

it("places a previously suspended opening above content that committed earlier", () => {
  const content = (ready: boolean) => (
    <>
      <Suspense fallback={<Text>Waiting</Text>}>
        <OrderMarker name="delayed" ready={ready} />
      </Suspense>
      <OrderMarker name="immediate" />
    </>
  );
  const { rerender } = render(content(false));
  const immediateOrder = screen.getByTestId("immediate").props.children;
  expect(screen.queryByTestId("delayed")).toBeNull();
  rerender(content(true));
  expect(screen.getByTestId("delayed").props.children).toBeGreaterThan(
    immediateOrder,
  );
  expect(screen.getByTestId("immediate").props.children).toBe(immediateOrder);
});

it.each([NaN, Infinity, -Infinity, 1.5, -2147483648, 2147483648])(
  "rejects stackOrder %s instead of passing inconsistent priority to native and web",
  (order) => {
    expect(() => render(<Example order={order} />)).toThrow(RangeError);
  },
);

it.each([-2147483647, 2147483647])(
  "accepts the supported priority boundary %s",
  (order) => {
    render(<Example order={order} />);
    expect(screen.UNSAFE_getAllByType(NativePortal)[0].props.stackOrder).toBe(
      order,
    );
  },
);
