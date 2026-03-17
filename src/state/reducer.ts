export type PortalState = {
  removed: Record<string, Record<string, Record<string, boolean>>>;
  hosts: Record<string, number>;
};

export type Action =
  | { type: "REMOVE_PORTAL"; hostName: string; name: string }
  | {
      type: "CLEAR_REMOVED_ON_UNMOUNT";
      hostName: string;
      name: string;
      instanceId: string;
    }
  | {
      type: "REGISTER_PORTAL";
      hostName: string;
      name: string;
      instanceId: string;
    }
  | { type: "REGISTER_HOST"; hostName: string }
  | { type: "UNREGISTER_HOST"; hostName: string };

export const initialState: PortalState = { removed: {}, hosts: {} };

export const reducer = (state: PortalState, action: Action): PortalState => {
  const cloned = { ...state, removed: { ...state.removed } };
  const hostRemoved =
    "name" in action ? cloned.removed[action.hostName] || {} : {};
  cloned.removed[action.hostName] = hostRemoved;
  const nameRemoved = "name" in action ? hostRemoved[action.name] || {} : {};
  if ("name" in action) {
    hostRemoved[action.name] = nameRemoved;
  }

  switch (action.type) {
    case "REGISTER_HOST": {
      const hosts = { ...cloned.hosts };
      hosts[action.hostName] = (hosts[action.hostName] || 0) + 1;
      return { ...cloned, hosts };
    }
    case "UNREGISTER_HOST": {
      const hosts = { ...cloned.hosts };
      const count = (hosts[action.hostName] || 0) - 1;
      if (count <= 0) {
        delete hosts[action.hostName];
      } else {
        hosts[action.hostName] = count;
      }
      return { ...cloned, hosts };
    }
    case "REGISTER_PORTAL":
      if (!nameRemoved[action.instanceId]) {
        nameRemoved[action.instanceId] = false;
      }
      return cloned;
    case "REMOVE_PORTAL":
      Object.keys(nameRemoved).forEach((id) => (nameRemoved[id] = true));
      return cloned;
    case "CLEAR_REMOVED_ON_UNMOUNT":
      delete nameRemoved[action.instanceId];
      if (Object.keys(nameRemoved).length === 0) {
        delete hostRemoved[action.name];
      }
      return cloned;
    default:
      return state;
  }
};
