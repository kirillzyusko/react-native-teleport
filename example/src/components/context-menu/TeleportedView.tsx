import React from "react";
import { Portal } from "react-native-teleport";

type Props = {
  teleported?: boolean;
};

const TeleportedView: React.FC<React.PropsWithChildren<Props>> = ({
  teleported,
  children,
}) => {
  return <Portal hostName={teleported ? "root" : undefined}>{children}</Portal>;
};

export default TeleportedView;
