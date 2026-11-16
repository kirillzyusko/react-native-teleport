import { createPortalStore } from "../state/portalStore";

it("releases a route name once its last host, portal and subscriber are gone", () => {
  const store = createPortalStore();
  const listener = jest.fn();

  const unsubscribe = store.subscribe("route", listener);
  const unregisterFirst = store.registerHost("route");
  const unregisterSecond = store.registerHost("route");
  const unregisterPortal = store.registerPortal("route", "item", "instance");
  store.removePortal("route", "item");

  unregisterFirst();
  expect(store.getHost("route")?.mounts).toBe(1);
  unregisterSecond();
  unsubscribe();
  expect(store.getHost("route")?.portals.get("item")?.get("instance")).toBe(
    true,
  );

  unregisterPortal();
  expect(store.getHost("route")).toBeUndefined();
  store.removePortal("already-gone", "item");
  expect(store.getHost("already-gone")).toBeUndefined();
});
