export type PortalState = {
  removed: Record<string, Record<string, Record<string, boolean>>>; // hostName -> name -> internalInstanceId -> true if removed
};

export type Action =
  | { type: "REMOVE_PORTAL"; hostName: string; name: string }
  | { type: "RESTORE_PORTAL"; hostName: string; name: string }
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
    };

export const initialState: PortalState = { removed: {} };

export const reducer = (state: PortalState, action: Action): PortalState => {
  const cloned = { ...state, removed: { ...state.removed } };
  const hostRemoved = cloned.removed[action.hostName] || {};
  cloned.removed[action.hostName] = hostRemoved;

  const nameRemoved = hostRemoved[action.name] || {};
  hostRemoved[action.name] = nameRemoved;

  switch (action.type) {
    case "REGISTER_PORTAL":
      // Ensure instanceId is tracked (optional, for safety)
      if (!nameRemoved[action.instanceId]) {
        nameRemoved[action.instanceId] = false; // Initialize as not removed
      }
      return cloned;
    case "REMOVE_PORTAL":
      Object.keys(nameRemoved).forEach((id) => (nameRemoved[id] = true));
      return cloned;
    case "RESTORE_PORTAL":
      hostRemoved[action.name] = {};
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
