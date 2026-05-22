export const ACTIVE_REEL_TRANSITION_NAME = "instagram-countdown-reel";

export type ViewTransitionDirection = "to-reels" | "to-feed";

export function prepareViewTransition(update: () => void) {
  update();
}

export function runViewTransition(
  update: () => void,
  _direction: ViewTransitionDirection,
  onFinish?: () => void,
) {
  update();
  onFinish?.();
}

export function getViewTransitionStyle(_name?: string) {
  return undefined;
}
