import { flushSync } from "react-dom";

export const ACTIVE_REEL_TRANSITION_NAME = "instagram-countdown-reel";

export type ViewTransitionDirection = "to-reels" | "to-feed";

type BrowserViewTransition = {
  finished: Promise<void>;
};

type StyleElement = {
  id: string;
  textContent: string;
};

type ViewTransitionDocument = {
  createElement: (tagName: "style") => StyleElement;
  documentElement: {
    classList: {
      add: (className: string) => void;
      remove: (className: string) => void;
    };
  };
  getElementById: (id: string) => unknown;
  head: {
    appendChild: (element: StyleElement) => void;
  };
  startViewTransition?: (update: () => void) => BrowserViewTransition;
};

declare const document: ViewTransitionDocument;

const FORWARD_CLASS = "instagram-vt-to-reels";
const BACK_CLASS = "instagram-vt-to-feed";
const STYLE_ID = "instagram-view-transition-styles";

const css = `
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0s;
}

html.${FORWARD_CLASS}::view-transition-group(${ACTIVE_REEL_TRANSITION_NAME}) {
  animation-duration: 5s;
  animation-timing-function: linear;
  z-index: 10;
}

html.${BACK_CLASS}::view-transition-group(${ACTIVE_REEL_TRANSITION_NAME}) {
  animation-duration: 3s;
  animation-timing-function: linear;
  z-index: 10;
}

html.${FORWARD_CLASS}::view-transition-old(${ACTIVE_REEL_TRANSITION_NAME}),
html.${FORWARD_CLASS}::view-transition-new(${ACTIVE_REEL_TRANSITION_NAME}) {
  animation-duration: 5s;
  animation-timing-function: linear;
  mix-blend-mode: normal;
  object-fit: fill;
  width: 100%;
  height: 100%;
}

html.${BACK_CLASS}::view-transition-old(${ACTIVE_REEL_TRANSITION_NAME}),
html.${BACK_CLASS}::view-transition-new(${ACTIVE_REEL_TRANSITION_NAME}) {
  animation-duration: 3s;
  animation-timing-function: linear;
  mix-blend-mode: normal;
  object-fit: fill;
  width: 100%;
  height: 100%;
}

html.${FORWARD_CLASS}::view-transition-old(${ACTIVE_REEL_TRANSITION_NAME}) {
  animation-name: instagram-vt-old-video-forward;
}

html.${FORWARD_CLASS}::view-transition-new(${ACTIVE_REEL_TRANSITION_NAME}) {
  animation-name: instagram-vt-new-video-forward;
}

html.${BACK_CLASS}::view-transition-old(${ACTIVE_REEL_TRANSITION_NAME}) {
  animation-name: instagram-vt-old-video-back;
}

html.${BACK_CLASS}::view-transition-new(${ACTIVE_REEL_TRANSITION_NAME}) {
  animation-name: instagram-vt-new-video-back;
}

@keyframes instagram-vt-old-video-forward {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes instagram-vt-new-video-forward {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes instagram-vt-old-video-back {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes instagram-vt-new-video-back {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
`;

function ensureViewTransitionStyles() {
  if (typeof document === "undefined") {
    return;
  }

  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

export function prepareViewTransition(update: () => void) {
  flushSync(update);
}

export function runViewTransition(
  update: () => void,
  direction: ViewTransitionDirection,
  onFinish?: () => void,
) {
  if (typeof document === "undefined") {
    update();
    onFinish?.();
    return;
  }

  const viewTransitionDocument = document as ViewTransitionDocument;

  if (!viewTransitionDocument.startViewTransition) {
    flushSync(update);
    onFinish?.();
    return;
  }

  ensureViewTransitionStyles();

  const className = direction === "to-reels" ? FORWARD_CLASS : BACK_CLASS;
  document.documentElement.classList.add(className);

  const transition = viewTransitionDocument.startViewTransition(() => {
    flushSync(update);
  });

  transition.finished.finally(() => {
    document.documentElement.classList.remove(className);
    onFinish?.();
  });
}

export function getViewTransitionStyle(name?: string) {
  return name ? ({ viewTransitionName: name } as const) : undefined;
}
