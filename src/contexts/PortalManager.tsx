import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type ReactNode,
} from "react";
import {
  initialState,
  reducer,
  type Action,
  type PortalState,
} from "../state/reducer";

const PortalManagerContext = createContext<
  { state: PortalState; dispatch: React.Dispatch<Action> } | undefined
>(undefined);

export const PortalManagerProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const context = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return (
    <PortalManagerContext.Provider value={context}>
      {children}
    </PortalManagerContext.Provider>
  );
};

export const usePortalManagerContext = () => {
  const context = useContext(PortalManagerContext);

  if (!context) {
    throw new Error("usePortalContext must be used within PortalProvider");
  }

  return context;
};
