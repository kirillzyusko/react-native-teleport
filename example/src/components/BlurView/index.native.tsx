import { BlurView } from "@react-native-community/blur";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

type BlurViewProps = {
  visible: boolean;
};

const AnimatedBlurView = ({ visible }: BlurViewProps) => {
  const [blurred, setBlurred] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setBlurred(true);
    }
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
      style={[StyleSheet.absoluteFillObject, { opacity: opacity }]}
      pointerEvents="none"
    >
      {blurred && (
        <BlurView
          style={StyleSheet.absoluteFillObject}
          overlayColor={"#00000000"}
          blurType="light"
          blurAmount={16}
        />
      )}
    </Animated.View>
  );
};

export default AnimatedBlurView;
