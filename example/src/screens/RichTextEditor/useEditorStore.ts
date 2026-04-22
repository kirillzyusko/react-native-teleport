import { create } from "zustand";

interface EditorStore {
  hostName: string | undefined;
  ready: boolean;
  setHostName: (hostName: string | undefined) => void;
  setReady: (ready: boolean) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  hostName: undefined,
  ready: false,
  setHostName: (hostName) => set({ hostName }),
  setReady: (ready) => set({ ready }),
}));
