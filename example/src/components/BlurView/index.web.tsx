import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

type BlurViewProps = {
  visible: boolean;
};

function BlurView({ visible }: BlurViewProps) {
  const [blurValue, setBlurValue] = useState(visible ? 16 : 0);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: false, // must be false for web (CSS props)
    }).start();
  }, [visible, opacity]);

  useEffect(() => {
    const id = opacity.addListener(({ value }) => setBlurValue(value));
    return () => opacity.removeListener(id);
  }, [opacity]);

  return (
    <div
      style={{
        position: "absolute",
        top: "0px",
        bottom: "0px",
        left: "0px",
        right: "0px",
        backdropFilter: `blur(${blurValue * 16}px)`,
        pointerEvents: "none",
      }}
    />
  );
}

export default BlurView;
