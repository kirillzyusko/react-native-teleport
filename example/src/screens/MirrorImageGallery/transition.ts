import {
  cancelAnimation,
  makeMutable,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { create } from "zustand";

import { SPRING_CONFIG } from "./constants";
import type { Photo } from "./photos";

export type TransitionPhase =
  | "idle"
  | "preparing-open"
  | "mounting-open"
  | "opening"
  | "finishing-open"
  | "detail"
  | "preparing-close"
  | "closing"
  | "finishing-close";

export type MirrorSource = "low-res" | "full-res";

export type ThumbnailPosition = {
  x: number;
  y: number;
  width: number;
};

type TransitionData = {
  phase: TransitionPhase;
  photo: Photo | null;
  position: ThumbnailPosition | null;
  mirrorSource: MirrorSource;
  isFullResReady: boolean;
  isOpeningAnimationDone: boolean;
};

type TransitionStore = TransitionData & {
  progress: SharedValue<number>;
  prepareOpen: (photo: Photo, position: ThumbnailPosition) => void;
  mountMirror: () => void;
  startOpening: () => void;
  finishOpening: () => void;
  completeOpeningHandoff: () => void;
  markFullResLoaded: (photoId: string) => void;
  prepareClose: () => void;
  startClosing: () => void;
  cancelOpening: () => void;
  finishClosing: () => void;
  reset: () => void;
};

const INITIAL_STATE: TransitionData = {
  phase: "idle",
  photo: null,
  position: null,
  mirrorSource: "low-res",
  isFullResReady: false,
  isOpeningAnimationDone: false,
};

const isOpeningReady = (state: TransitionStore) =>
  state.isFullResReady && state.isOpeningAnimationDone;

export const isOverlayPhase = (phase: TransitionPhase) =>
  phase !== "idle" && phase !== "detail";

export const isThumbnailVisible = (phase: TransitionPhase) =>
  phase === "idle" ||
  phase === "preparing-open" ||
  phase === "mounting-open" ||
  phase === "finishing-close";

export const isDestinationVisible = (phase: TransitionPhase) =>
  phase === "finishing-open" ||
  phase === "detail" ||
  phase === "preparing-close";

export const useMirrorTransition = create<TransitionStore>((set, get) => ({
  ...INITIAL_STATE,
  progress: makeMutable(0),

  prepareOpen: (photo, position) => {
    const state = get();
    if (state.phase !== "idle") {
      return;
    }

    cancelAnimation(state.progress);
    state.progress.set(0);
    set({
      ...INITIAL_STATE,
      phase: "preparing-open",
      photo,
      position,
    });
  },

  mountMirror: () => {
    if (get().phase === "preparing-open") {
      set({ phase: "mounting-open" });
    }
  },

  startOpening: () => {
    const state = get();
    if (state.phase !== "mounting-open") {
      return;
    }

    set({ phase: "opening" });
    const onFinished = get().finishOpening;
    state.progress.set(
      withSpring(1, SPRING_CONFIG, (finished) => {
        if (finished) {
          scheduleOnRN(onFinished);
        }
      }),
    );
  },

  finishOpening: () => {
    if (get().phase !== "opening") {
      return;
    }

    set({ isOpeningAnimationDone: true });
    if (isOpeningReady(get())) {
      set({ phase: "finishing-open" });
    }
  },

  completeOpeningHandoff: () => {
    if (get().phase === "finishing-open") {
      set({ phase: "detail" });
    }
  },

  markFullResLoaded: (photoId) => {
    const state = get();
    if (state.photo?.id !== photoId || state.phase === "idle") {
      return;
    }

    set({
      isFullResReady: true,
      mirrorSource: "full-res",
    });
    if (get().phase === "opening" && isOpeningReady(get())) {
      set({ phase: "finishing-open" });
    }
  },

  prepareClose: () => {
    const phase = get().phase;
    if (phase !== "detail" && phase !== "finishing-open") {
      return;
    }

    set({ phase: "preparing-close", mirrorSource: "full-res" });
  },

  startClosing: () => {
    const state = get();
    if (state.phase !== "preparing-close" && state.phase !== "opening") {
      return;
    }

    set({ phase: "closing" });
    const onFinished = get().finishClosing;
    state.progress.set(
      withSpring(0, SPRING_CONFIG, (finished) => {
        if (finished) {
          scheduleOnRN(onFinished);
        }
      }),
    );
  },

  cancelOpening: () => {
    const phase = get().phase;
    if (phase === "preparing-open" || phase === "mounting-open") {
      set({ phase: "finishing-close" });
    } else if (phase === "opening") {
      get().startClosing();
    } else if (phase === "finishing-open") {
      get().prepareClose();
    }
  },

  finishClosing: () => {
    if (get().phase === "closing") {
      set({ phase: "finishing-close" });
    }
  },

  reset: () => {
    const progress = get().progress;
    cancelAnimation(progress);
    progress.set(0);
    set(INITIAL_STATE);
  },
}));
