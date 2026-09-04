/// <reference lib="dom" />

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import type { PortalProps } from "../types";

const mockGetHost = jest.fn<HTMLElement | null, [string]>();
const mockRegisterPendingPortal = jest.fn();
const mockUnregisterPendingPortal = jest.fn();
const mockRegistry = {
  getHost: mockGetHost,
  registerPendingPortal: mockRegisterPendingPortal,
  unregisterPendingPortal: mockUnregisterPendingPortal,
};

jest.mock("../contexts/PortalRegistry", () => ({
  usePortalRegistryContext: () => mockRegistry,
}));

jest.mock("react-dom", () => ({
  createPortal: (children: ReactNode) => children,
}));

type MockElement = {
  children: MockElement[];
  insertBefore: jest.Mock;
  moveBefore: jest.Mock;
  parentElement: MockElement | null;
  parentNode: MockElement | null;
  removeChild: jest.Mock;
  style: Record<string, unknown>;
};

function detach(child: MockElement) {
  const parent = child.parentNode;
  if (parent) {
    parent.children = parent.children.filter(
      (candidate) => candidate !== child,
    );
  }
  child.parentElement = null;
  child.parentNode = null;
}

function createMockElement(): MockElement {
  const element: MockElement = {
    children: [],
    insertBefore: jest.fn(),
    moveBefore: jest.fn(),
    parentElement: null,
    parentNode: null,
    removeChild: jest.fn(),
    style: {},
  };

  const insert = (child: MockElement, before: MockElement | null) => {
    detach(child);
    const index = before ? element.children.indexOf(before) : -1;
    if (index === -1) {
      element.children.push(child);
    } else {
      element.children.splice(index, 0, child);
    }
    child.parentElement = element;
    child.parentNode = element;
  };

  element.insertBefore.mockImplementation(insert);
  element.moveBefore.mockImplementation(insert);
  element.removeChild.mockImplementation((child: MockElement) => {
    detach(child);
    return child;
  });

  return element;
}

const originalDocument = global.document;
const originalElement = global.Element;
const mockCreateElement = jest.fn();

class MockDomElement {}

Object.defineProperty(MockDomElement.prototype, "moveBefore", {
  configurable: true,
  value: () => undefined,
});
Object.defineProperty(global, "Element", {
  configurable: true,
  value: MockDomElement,
});
Object.defineProperty(global, "document", {
  configurable: true,
  value: { createElement: mockCreateElement },
});

const Portal = jest.requireActual<{ default: ComponentType<PortalProps> }>(
  "../views/Portal/index.tsx",
).default;

afterAll(() => {
  Object.defineProperty(global, "Element", {
    configurable: true,
    value: originalElement,
  });
  Object.defineProperty(global, "document", {
    configurable: true,
    value: originalDocument,
  });
});

function StatefulChild() {
  const [count, setCount] = useState(0);

  return (
    <button aria-label="counter" onClick={() => setCount((value) => value + 1)}>
      Count: {count}
    </button>
  );
}

describe("web Portal lifecycle", () => {
  it("preserves its container and child state while switching hosts", () => {
    const firstHost = createMockElement();
    const secondHost = createMockElement();
    const portalContainer = createMockElement();
    const sentinel = createMockElement();
    mockCreateElement.mockReturnValue(portalContainer);
    mockGetHost.mockImplementation(
      (name) =>
        (name === "first" ? firstHost : secondHost) as unknown as HTMLElement,
    );

    const { rerender, unmount } = render(
      <Portal hostName="first">
        <StatefulChild />
      </Portal>,
      { createNodeMock: () => sentinel },
    );

    expect(firstHost.children).toEqual([portalContainer]);
    fireEvent(screen.getByLabelText("counter"), "click");
    expect(screen.getByLabelText("counter").props.children).toEqual([
      "Count: ",
      1,
    ]);

    rerender(
      <Portal hostName="second">
        <StatefulChild />
      </Portal>,
    );

    expect(firstHost.removeChild).not.toHaveBeenCalled();
    expect(secondHost.moveBefore).toHaveBeenCalledWith(portalContainer, null);
    expect(secondHost.children).toEqual([portalContainer]);
    expect(screen.getByLabelText("counter").props.children).toEqual([
      "Count: ",
      1,
    ]);

    unmount();
    expect(secondHost.removeChild).toHaveBeenCalledWith(portalContainer);
    expect(portalContainer.parentNode).toBeNull();
  });
});
