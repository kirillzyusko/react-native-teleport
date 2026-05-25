import { create } from "zustand";

type ViewTransitionOwner = "feed" | "reels";

type ViewTransitionState = {
  isRunning: boolean;
  owner?: ViewTransitionOwner;
  postId?: number;
  clearTarget: () => void;
  finishTransition: () => void;
  setRunning: (isRunning: boolean) => void;
  setTarget: (postId: number, owner: ViewTransitionOwner) => void;
};

export const useViewTransition = create<ViewTransitionState>((set) => ({
  isRunning: false,
  owner: undefined,
  postId: undefined,
  clearTarget: () =>
    set({ isRunning: false, owner: undefined, postId: undefined }),
  finishTransition: () => set({ isRunning: false }),
  setRunning: (isRunning) => set({ isRunning }),
  setTarget: (postId, owner) => set({ owner, postId }),
}));
