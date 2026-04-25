import React, { useEffect } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";

import { useTeleport } from "./teleport/context";
import { BlurView } from "@react-native-community/blur";

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
  const blur = useAnimatedStyle(
    () => ({
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: progress.value,
    }),
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
      <ReanimatedBlurView style={blur} blurType="dark" blurAmount={6} />
    </>
  );
};

export default BlurredBackground;
