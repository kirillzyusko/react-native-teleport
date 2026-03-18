import {
  type SharedValue,
  makeMutable,
  runOnJS,
  withTiming,
} from "react-native-reanimated";
import { create } from "zustand";

type Position = {
  x: number;
  y: number;
};

interface HeroStore {
  /** Which photo is currently animating */
  id: string;
  /** Animation progress [0..1] */
  progress: SharedValue<number>;
  /** Measured position of the thumbnail before transition */
  position: Position | undefined;
  visibility: {
    /** Opacity of the source (thumbnail in grid) */
    source: number;
    /** Opacity of the target (full-res image on detail screen) */
    target: number;
  };
  set: (newState: Partial<Omit<HeroStore, "set">>) => void;
  isAnimationCompleted: boolean;
  isTargetElementAvailable: boolean;
  transitionCompleted: () => void;
  targetElementAvailable: () => void;
}

export const useHeroTransition = create<HeroStore>((set, get) => ({
  id: "",
  position: undefined,
  visibility: { source: 1, target: 0 },
  progress: makeMutable(0),
  isAnimationCompleted: false,
  isTargetElementAvailable: false,
  set: (newState) => set((state) => ({ ...state, ...newState })),

  transitionCompleted: () => {
    set({ isAnimationCompleted: true });

    if (get().isTargetElementAvailable) {
      get().targetElementAvailable();
    }
  },

  targetElementAvailable: () => {
    set({ isTargetElementAvailable: true });

    if (!get().isAnimationCompleted) {
      return;
    }

    const teleportBack = () => {
      // Wait several frames then reset — detach animated style
      // and return thumbnail to normal grid rendering
      setTimeout(() => {
        set({
          id: "",
          position: undefined,
          visibility: { source: 1, target: 1 },
        });
      }, 48);
    };

    // Swap visibility: hide source thumbnail, show target full-res image
    set({
      visibility: { source: 0, target: 1 },
      isTargetElementAvailable: false,
      isAnimationCompleted: false,
    });

    // Animate progress back to 0 (instantly) to return thumbnail to grid position,
    // then detach from portal host
    setTimeout(() => {
      get().progress.set(
        withTiming(0, { duration: 0 }, () => {
          runOnJS(teleportBack)();
        }),
      );
    }, 16);
  },
}));
