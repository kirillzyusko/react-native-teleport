import React from "react";
import { View } from "react-native";
import { Portal } from "react-native-teleport";

type Props = {
  teleported?: boolean;
};

const TeleportedView: React.FC<React.PropsWithChildren<Props>> = ({
  teleported,
  children,
  position,
}) => {
  return (
    <Portal hostName={teleported ? "root" : undefined}>
      <View style={{ top: teleported ? position.top : 0 }}>{children}</View>
    </Portal>
  );
};

export default TeleportedView;
