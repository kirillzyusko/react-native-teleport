import { memo, useEffect } from "react";
import { usePortalManagerContext } from "../contexts/PortalManager";
import PortalView from "../views/Portal";
import useId from "../hooks/useId";
import type { PortalProps } from "../types";

const PortalComponent = ({ hostName, name, children }: PortalProps) => {
  const { state, dispatch } = usePortalManagerContext();
  const instanceId = useId();

  const isRemoved =
    hostName && name ? state.removed[hostName]?.[name]?.[instanceId] : false;

  useEffect(() => {
    if (!hostName || !name) {
      return;
    }

    dispatch({ type: "REGISTER_PORTAL", hostName, name, instanceId });

    return () => {
      dispatch({
        type: "CLEAR_REMOVED_ON_UNMOUNT",
        hostName,
        name,
        instanceId,
      });
    };
  }, [dispatch, hostName, name, instanceId]);

  if (isRemoved) {
    return <PortalView hostName={hostName} name={name} />;
  }

  return (
    <PortalView hostName={hostName} name={name}>
      {children}
    </PortalView>
  );
};

const Portal = memo(PortalComponent);

export default Portal;
