import { makeMutable, withSpring } from "react-native-reanimated";
import { create } from "zustand";
import type { HeroElementRegistration, HeroTransition } from "./types";
import { scheduleOnRN } from "react-native-worklets";

type TransitionPhase = "idle" | "forward" | "backward";

type HeroStore = {
  source: Record<string, HeroElementRegistration | undefined>;
  target: Record<string, HeroElementRegistration | undefined>;
  transitions: Record<string, HeroTransition | undefined>;

  // Single animated driver for all hero elements
  progress: ReturnType<typeof makeMutable<number>>;
  phase: TransitionPhase;

  registerSource: (id: string, reg: HeroElementRegistration) => void;
  registerTarget: (id: string, reg: HeroElementRegistration) => void;
  unregisterSource: (id: string) => void;
  unregisterTarget: (id: string) => void;
};

const SPRING_CONFIG = {
  mass: 3,
  damping: 1000,
  stiffness: 500,
};

export const useHeroStore = create<HeroStore>((set, get) => ({
  source: {},
  target: {},
  transitions: {},
  progress: makeMutable(0),
  phase: "idle",

  registerSource: (id, reg) => {
    set((s) => ({ source: { ...s.source, [id]: reg } }));
  },

  registerTarget: (id, reg) => {
    set((s) => ({ target: { ...s.target, [id]: reg } }));

    const source = get().source[id];
    if (!source) return;

    // Store transition rects for this element
    set((s) => ({
      transitions: {
        ...s.transitions,
        [id]: {
          sourceRect: source.rect,
          targetRect: reg.rect,
          sourceStyle: source.flatStyle,
          targetStyle: reg.flatStyle,
        },
      },
    }));

    // Start forward animation on the single shared driver
    // (only if not already running — first target to register kicks it off)
    if (get().phase === "idle") {
      const { progress } = get();
      set({ phase: "forward" });
      const completeForward = () => {
        set({ phase: "idle" });
      };
      progress.set(
        withSpring(1, SPRING_CONFIG, () => {
          scheduleOnRN(completeForward);
        }),
      );
    }
  },

  unregisterTarget: (id) => {
    const transition = get().transitions[id];
    const source = get().source[id];

    // Clean up target registration
    set((s) => {
      const { [id]: _, ...rest } = s.target;
      return { target: rest };
    });

    if (!transition || !source) return;

    // Start backward animation on the single shared driver
    // (only if not already running — first target to unregister kicks it off)
    if (get().phase === "idle") {
      const { progress } = get();
      set({ phase: "backward" });
      const clearTransition = () => {
        set((s) => {
          const { [id]: _, ...rest } = s.transitions;
          return { transitions: rest, phase: "idle" };
        });
      };
      progress.set(
        withSpring(0, SPRING_CONFIG, () => {
          scheduleOnRN(clearTransition);
        }),
      );
    }
  },

  unregisterSource: (id) => {
    set((s) => {
      const { [id]: _, ...rest } = s.source;
      return { source: rest };
    });
  },
}));
