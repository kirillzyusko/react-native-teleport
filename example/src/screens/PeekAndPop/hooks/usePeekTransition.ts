import {
  makeMutable,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { create } from "zustand";

import { DETAILS_DESTINATION, OVERLAY_DESTINATION } from "../constants";

export type TransitionLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Destination =
  | typeof OVERLAY_DESTINATION
  | typeof DETAILS_DESTINATION
  | undefined;

type Phase = "idle" | "peek" | "popping" | "details" | "closing" | "restoring";

type PeekTransition = {
  destination: Destination;
  layout: TransitionLayout;
  movieId?: string;
  phase: Phase;
  progress: SharedValue<number>;
  peek: (movieId: string, layout: TransitionLayout) => void;
  popToDetails: () => void;
  closeDetails: (onFinish?: () => void) => void;
  cancelPeek: () => void;
};

const EMPTY_LAYOUT: TransitionLayout = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

const SPRING_CONFIG = {
  mass: 1,
  damping: 32,
  stiffness: 260,
};

const afterNextPaint = (callback?: () => void) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      callback?.();
    });
  });
};

export const usePeekTransition = create<PeekTransition>((set, get) => ({
  destination: undefined,
  layout: EMPTY_LAYOUT,
  movieId: undefined,
  phase: "idle",
  progress: makeMutable(0),
  peek: (movieId, layout) => {
    get().progress.set(0);
    set({ destination: OVERLAY_DESTINATION, layout, movieId, phase: "peek" });
    get().progress.set(withSpring(1, SPRING_CONFIG));
  },
  popToDetails: () => {
    if (!get().movieId || get().phase !== "peek") {
      return;
    }

    set({ destination: OVERLAY_DESTINATION, phase: "popping" });

    const settleInDetails = () => {
      set({ destination: DETAILS_DESTINATION, phase: "details" });
    };

    get().progress.set(
      withSpring(2, SPRING_CONFIG, () => {
        scheduleOnRN(settleInDetails);
      }),
    );
  },
  closeDetails: (onFinish) => {
    if (!get().movieId) {
      onFinish?.();
      return;
    }

    set({ destination: OVERLAY_DESTINATION, phase: "closing" });

    const restorePortalHome = () => {
      set({ destination: undefined, phase: "restoring" });

      afterNextPaint(() => {
        set({
          destination: undefined,
          layout: EMPTY_LAYOUT,
          movieId: undefined,
          phase: "idle",
        });
        onFinish?.();
      });
    };

    get().progress.set(
      withSpring(0, SPRING_CONFIG, () => {
        scheduleOnRN(restorePortalHome);
      }),
    );
  },
  cancelPeek: () => {
    if (!get().movieId) {
      return;
    }

    set({ destination: OVERLAY_DESTINATION, phase: "closing" });

    const finish = () => {
      set({
        destination: undefined,
        layout: EMPTY_LAYOUT,
        movieId: undefined,
        phase: "idle",
      });
    };

    get().progress.set(
      withSpring(0, SPRING_CONFIG, () => {
        scheduleOnRN(finish);
      }),
    );
  },
}));
