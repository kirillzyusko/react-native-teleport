import { BlurView } from "@react-native-community/blur";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

type BlurViewProps = {
  visible: boolean;
};

const AnimatedBlurView = ({ visible }: BlurViewProps) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { opacity: opacity }]}
      pointerEvents="none"
    >
      <BlurView
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
        blurType="light"
        blurAmount={16}
      />
    </Animated.View>
  );
};

export default AnimatedBlurView;
