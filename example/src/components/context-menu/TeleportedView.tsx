import React, { useEffect } from "react";
import { View } from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Portal } from "react-native-teleport";
import { useTeleport } from "./teleport/context";

type Props = {
  teleported?: boolean;
};

const TeleportedView: React.FC<React.PropsWithChildren<Props>> = ({
  teleported,
  children,
}) => {
  const { progress } = useTeleport();

  const s = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: -progress.value * 230,
      },
    ],
  }));

  return (
    <Portal hostName={teleported ? "root" : undefined}>
      <Reanimated.View
        style={[{ top: teleported ? 380 : 0, left: teleported ? 16 : 0 }, s]}
      >
        {children}
      </Reanimated.View>
    </Portal>
  );
};

export default TeleportedView;
