import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type TourStep = {
  id: string;
  title: string;
  description: string;
  placement?: "top" | "bottom";
  tipOffsetY?: number;
};

export type Layout = { x: number; y: number; width: number; height: number };

type TourContextValue = {
  activeId: string | null;
  step: TourStep | null;
  stepIndex: number;
  totalSteps: number;
  steps: TourStep[];
  layouts: Record<string, Layout>;
  registerLayout: (id: string, layout: Layout) => void;
  start: () => void;
  next: () => void;
  stop: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export const TOUR_STEPS: TourStep[] = [
  {
    id: "card",
    title: "Your balance",
    description: "Tap the card to view details and freeze it instantly.",
    placement: "bottom",
    tipOffsetY: -20,
  },
  {
    id: "actions",
    title: "Quick actions",
    description: "Send, request, or top up — all in a single tap.",
    placement: "bottom",
  },
  {
    id: "transactions",
    title: "Recent activity",
    description: "Pull to refresh and see every penny going in and out.",
    placement: "top",
    tipOffsetY: -40,
  },
  {
    id: "bell",
    title: "Stay in the loop",
    description: "We'll ping you whenever something important happens.",
    placement: "bottom",
  },
];

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [stepIndex, setStepIndex] = useState(-1);
  const layouts = useRef<Record<string, Layout>>({}).current;
  const [, force] = useState(0);

  const registerLayout = useCallback(
    (id: string, layout: Layout) => {
      const prev = layouts[id];
      if (
        prev &&
        prev.x === layout.x &&
        prev.y === layout.y &&
        prev.width === layout.width &&
        prev.height === layout.height
      ) {
        return;
      }
      layouts[id] = layout;
      force((n) => n + 1);
    },
    [layouts],
  );

  const start = useCallback(() => setStepIndex(0), []);
  const stop = useCallback(() => setStepIndex(-1), []);
  const next = useCallback(() => {
    setStepIndex((i) => (i + 1 >= TOUR_STEPS.length ? -1 : i + 1));
  }, []);

  const step = stepIndex >= 0 ? (TOUR_STEPS[stepIndex] ?? null) : null;
  const activeId = step?.id ?? null;

  const value = useMemo<TourContextValue>(
    () => ({
      activeId,
      step,
      stepIndex,
      totalSteps: TOUR_STEPS.length,
      steps: TOUR_STEPS,
      layouts,
      registerLayout,
      start,
      next,
      stop,
    }),
    [activeId, step, stepIndex, layouts, registerLayout, start, next, stop],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within TourProvider");
  }
  return ctx;
}
