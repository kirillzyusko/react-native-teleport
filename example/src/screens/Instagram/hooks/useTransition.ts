import {
  makeMutable,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { create } from "zustand";

interface Transition {
  destination?: string;
  id?: number;
  y: number;
  progress: SharedValue<number>;
  setDestination: (destination?: string) => void;
  setId: (id: number) => void;
  goToReels: (y: number) => void;
  goToFeed: (onFinish?: () => void) => void;
}

const SPRING_CONFIG = { mass: 3, damping: 500, stiffness: 1000 };

// TODO: fix bugs
// - if you scrolled down and then press back button - we need to animate opacity
// - on Android icons on full screen reels are not animating (same problem as we had with Header)
// - scroll to squirrel so that it sits on top - press on it and see how text stays on top of everything
// - check pressability of icons on full screen reels
// - close reels screen and start to scroll - you will see content of second screen overlapping first screen
export const useTransition = create<Transition>((set, get) => ({
  destination: undefined,
  id: undefined,
  y: 0,
  progress: makeMutable(0),
  setDestination: (destination?: string) => {
    set({ destination });
  },
  setId: (id: number) => {
    set({ id });
  },
  goToReels: (y) => {
    set({ destination: "overlay", y });
    const moveToReels = () => {
      set({ destination: "reels" });
    };
    get().progress.set(
      withSpring(1, SPRING_CONFIG, () => {
        scheduleOnRN(moveToReels);
      }),
    );
  },
  goToFeed: (onFinish) => {
    set({ destination: "overlay" });
    const moveToFeed = () => {
      set({ destination: undefined, y: 0 });
      onFinish?.();
    };
    get().progress.set(
      withSpring(0, SPRING_CONFIG, () => {
        scheduleOnRN(moveToFeed);
      }),
    );
  },
}));
