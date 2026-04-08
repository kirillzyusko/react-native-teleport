import React, { useEffect, useRef } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useHeroStore } from "./store";

type Props = {
  children: React.ReactNode;
};

export default function HeroReveal({ children }: Props) {
  const phase = useHeroStore((s) => s.phase);
  const prevPhase = useRef(phase);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const easing = Easing.inOut(Easing.ease);

    if (prevPhase.current === "forward" && phase === "idle") {
      // Forward transition just completed — reveal content
      opacity.value = withTiming(1, { duration: 250, easing });
    } else if (phase === "backward") {
      // Backward transition starting — hide content
      opacity.value = withTiming(0, { duration: 200, easing });
    }

    prevPhase.current = phase;
  }, [phase, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
