import { memo, useEffect, type ReactNode } from "react";
import { usePortalManagerContext } from "../contexts/PortalManager";
import PortalView from "../views/Portal";
import useId from "../hooks/useId";
import type { PortalProps } from "../types";

const PortalComponent = ({ hostName, name, children }: PortalProps) => {
  const { state, dispatch } = usePortalManagerContext();
  const instanceId = useId(); // Автоматически unique, e.g. ":r1:"

  const isRemoved = state.removed[hostName]?.[name]?.[instanceId] ?? false;
  console.log(98989, instanceId, state, hostName, name, { isRemoved });
  useEffect(() => {
    dispatch({ type: "REGISTER_PORTAL", hostName, name, instanceId });
    return () => {
      // Cleanup: Сбрасываем только для этого internal instanceId
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
