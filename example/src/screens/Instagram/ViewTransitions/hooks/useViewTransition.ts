import { create } from "zustand";

type ViewTransitionOwner = "feed" | "reels";

type ViewTransitionState = {
  owner?: ViewTransitionOwner;
  postId?: number;
  clearTarget: () => void;
  setTarget: (postId: number, owner: ViewTransitionOwner) => void;
};

export const useViewTransition = create<ViewTransitionState>((set) => ({
  owner: undefined,
  postId: undefined,
  clearTarget: () => set({ owner: undefined, postId: undefined }),
  setTarget: (postId, owner) => set({ owner, postId }),
}));
