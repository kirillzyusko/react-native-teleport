import { Animated } from "react-native";
import { create } from "zustand";

interface Transition {
  destination?: string;
  id?: number;
  y: number;
  progress: Animated.Value;
  layout: Animated.Value;
  setDestination: (destination?: string) => void;
  setId: (id: number) => void;
  goToReels: (y: number) => void;
  goToFeed: (onFinish?: () => void) => void;
}

// TODO: fix bugs
// - why on Android video becomes black for a fraction of a second? Happens only after teleportation into destination? Timing issue (wrap in setTimeout?) Layout issue? Pausing/resetting issue? Xiaomi API 28 still have issue, looks like it has been fixed on real devices starting from API 29+ I can not reproduce issue on Pixel 7 Pro Android 16
// - reels scrolling
// - if you scrolled a little bit and then back - we need to animate opacity
export const useTransition = create<Transition>((set, get) => ({
  destination: undefined,
  id: undefined,
  y: 0,
  progress: new Animated.Value(0),
  layout: new Animated.Value(0),
  setDestination: (destination?: string) => {
    set({ destination });
  },
  setId: (id: number) => {
    set({ id });
  },
  goToReels: (y) => {
    set({ destination: "overlay", y });
    Animated.spring(get().progress, {
      toValue: 1,
      mass: 3,
      damping: 500,
      stiffness: 1000,
      useNativeDriver: true,
    }).start(() => {
      set({ destination: "reels" });
    });
    Animated.spring(get().layout, {
      toValue: 1,
      mass: 3,
      damping: 500,
      stiffness: 1000,
      useNativeDriver: false,
    }).start();
  },
  goToFeed: (onFinish) => {
    set({ destination: "overlay" });
    Animated.spring(get().progress, {
      toValue: 0,
      mass: 3,
      damping: 500,
      stiffness: 1000,
      useNativeDriver: true,
    }).start(() => {
      set({ destination: undefined, y: 0 });
      onFinish?.();
    });
    Animated.spring(get().layout, {
      toValue: 0,
      mass: 3,
      damping: 500,
      stiffness: 1000,
      useNativeDriver: false,
    }).start();
  },
}));
