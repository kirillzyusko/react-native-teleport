import type { ScrollViewContextValue } from "../contexts/ScrollViewContext/types";

type Listener = () => void;

type Host = {
  mounts: number;
  scrollContext: ScrollViewContextValue;
  // Named portals can be registered before their host mounts.
  portals: Map<string, Map<string, boolean>>;
  listeners: Set<Listener>;
};

export function createPortalStore() {
  const hosts = new Map<string, Host>();

  function getOrCreate(name: string): Host {
    let host = hosts.get(name);
    if (!host) {
      host = {
        mounts: 0,
        scrollContext: null,
        portals: new Map(),
        listeners: new Set(),
      };
      hosts.set(name, host);
    }
    return host;
  }

  function release(name: string, host: Host) {
    if (!host.mounts && !host.portals.size && !host.listeners.size) {
      hosts.delete(name);
    }
  }

  function notify(host: Host) {
    host.listeners.forEach((listener) => listener());
  }

  return {
    getHost: (name: string | undefined) =>
      name === undefined ? undefined : hosts.get(name),

    subscribe(name: string | undefined, listener: Listener) {
      if (name === undefined) return () => {};
      const host = getOrCreate(name);
      host.listeners.add(listener);
      return () => {
        host.listeners.delete(listener);
        release(name, host);
      };
    },

    registerHost(name: string) {
      const host = getOrCreate(name);
      host.mounts++;
      if (host.mounts === 1) notify(host);
      return () => {
        host.mounts--;
        if (host.mounts === 0) {
          host.scrollContext = null;
          notify(host);
        }
        release(name, host);
      };
    },

    setScrollContext(name: string, value: ScrollViewContextValue) {
      const host = hosts.get(name);
      if (host && host.scrollContext !== value) {
        host.scrollContext = value;
        notify(host);
      }
    },

    registerPortal(hostName: string, name: string, id: string) {
      const host = getOrCreate(hostName);
      const instances = host.portals.get(name) ?? new Map<string, boolean>();
      host.portals.set(name, instances);
      instances.set(id, false);
      return () => {
        const wasRemoved = instances.get(id);
        instances.delete(id);
        if (!instances.size) host.portals.delete(name);
        if (wasRemoved) notify(host);
        release(hostName, host);
      };
    },

    removePortal(hostName: string, name: string) {
      const host = hosts.get(hostName);
      const instances = host?.portals.get(name);
      if (!host || !instances) return;
      instances.forEach((_, id) => instances.set(id, true));
      notify(host);
    },
  };
}

export type PortalStore = ReturnType<typeof createPortalStore>;
