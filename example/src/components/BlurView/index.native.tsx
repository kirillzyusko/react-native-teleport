import { BlurView } from "@react-native-community/blur";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

type BlurViewProps = {
  visible: boolean;
};

const AnimatedBlurView = ({ visible }: BlurViewProps) => {
  const [blurred, setBlurred] = useState(visible);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setBlurred(visible);
    });
  }, [opacity, visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: opacity }]}
    >
      {(visible || blurred) && (
        <BlurView
          blurAmount={16}
          blurType="light"
          overlayColor={"#00000000"}
          style={StyleSheet.absoluteFill}
        />
      )}
    </Animated.View>
  );
};

export default AnimatedBlurView;
