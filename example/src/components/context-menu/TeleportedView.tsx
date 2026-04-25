import React from "react";
import { Portal } from "react-native-teleport";

type Props = {
  teleported?: boolean;
};

const TeleportedView: React.FC<React.PropsWithChildren<Props>> = ({
  teleported,
  children,
}) => {
  return (
    <Portal hostName={teleported ? "context-menu-teleport" : undefined}>
      {children}
    </Portal>
  );
};

export default TeleportedView;
