import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import Reanimated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";

import { useTeleport } from "./teleport/context";
import BlurView from "../BlurView";

const ReanimatedBlurView = Reanimated.createAnimatedComponent(BlurView);

type Props = {};

const styles = StyleSheet.create({
  stretch: {
    width: "100%",
    height: "100%",
  },
});

/**
 * Component that blurs entire screen when it's shown. Primarily used in conjunction with `ContextMenu`.
 * Also hides `StatusBar` when component is shown and show it again when component gets hidden (telegram
 * does the same).
 */
const BlurredBackground: React.FC<Props> = () => {
  const { progress } = useTeleport();
  const [visible, setVisible] = useState(false);

  useAnimatedReaction(
    () => progress.value,
    (next, prev) => {
      if (next === null) {
        return;
      }
      if (prev === 0 && next > 0) {
        runOnJS(setVisible)(true);
      }
      if (prev === 1 && next < 1) {
        runOnJS(setVisible)(false);
      }
    },
    [],
  );

  useEffect(() => {
    // https://app.asana.com/0/1201479125182522/1203474957902936
    StatusBar.setHidden(true, "fade");

    return () => {
      StatusBar.setHidden(false, "fade");
    };
  }, []);

  return (
    <>
      <View style={styles.stretch} />
      <ReanimatedBlurView visible={visible} />
    </>
  );
};

export default BlurredBackground;
