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
    const source = get().source[id];
    if (!source) {
      set((s) => ({ target: { ...s.target, [id]: reg } }));
      return;
    }

    const shouldStartForward = get().phase === "idle";
    const { progress } = get();

    if (shouldStartForward) {
      progress.set(0);
    }

    // Publish the transition and its active phase together. Otherwise the
    // target becomes visible for one render between these two store updates.
    set((s) => ({
      target: { ...s.target, [id]: reg },
      transitions: {
        ...s.transitions,
        [id]: {
          sourceRect: source.rect,
          targetRect: reg.rect,
          sourceStyle: source.flatStyle,
          targetStyle: reg.flatStyle,
        },
      },
      ...(shouldStartForward && { phase: "forward" as const }),
    }));

    // Start forward animation on the single shared driver
    // (only if not already running — first target to register kicks it off)
    if (shouldStartForward) {
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
      const target = { ...s.target };
      delete target[id];
      return { target };
    });

    if (!transition || !source) return;

    // Start backward animation on the single shared driver
    // (only if not already running — first target to unregister kicks it off)
    if (get().phase === "idle") {
      const { progress } = get();
      set({ phase: "backward" });
      const clearTransition = () => {
        set((s) => {
          const transitions = { ...s.transitions };
          delete transitions[id];
          return { transitions, phase: "idle" };
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
    const source = { ...get().source };
    delete source[id];

    if (Object.keys(source).length === 0) {
      get().progress.set(0);
      set({ source, target: {}, transitions: {}, phase: "idle" });
      return;
    }

    set({ source });
  },
}));
