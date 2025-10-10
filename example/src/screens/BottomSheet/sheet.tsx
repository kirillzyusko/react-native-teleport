import React, { useEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Reanimated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

type BottomSheetContainerProps = {
  children: React.ReactNode;
  visible: boolean;
  backdrop?: boolean;
};

export function BottomSheetContainer({
  visible,
  children,
}: BottomSheetContainerProps) {
  const [shown, setShown] = useState(visible);
  const progress = useSharedValue(0);
  const height = useSharedValue(9999);

  const onLayout = (e: LayoutChangeEvent) => {
    height.value = e.nativeEvent.layout.height;
  };

  useEffect(() => {
    if (visible) {
      setShown(true);
    }
    progress.set(
      withSpring(
        visible ? 1 : 0,
        {
          mass: 3,
          stiffness: 1000,
          damping: 500,
        },
        () => {
          runOnJS(setShown)(visible);
        },
      ),
    );
  }, [visible, progress]);

  const style = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: height.value },
        { translateY: shown ? -(progress.value * height.value) : 0 },
      ],
    }),
    [shown],
  );

  const scrimStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 1], [0, 1]),
      backgroundColor: "#3c3c3c60",
    };
  }, []);

  return (
    <>
      {visible && <Reanimated.View style={[styles.scrim, scrimStyle]} />}
      <Reanimated.View style={[styles.container, style]}>
        <View onLayout={onLayout}>{children}</View>
      </Reanimated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "flex-end",
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});

export default BottomSheetContainer;
