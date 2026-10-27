import { Platform, type GestureResponderEvent } from "react-native";
import {
  createVisualTraceBuffer,
  type VisualTraceIdentity,
} from "./visualTraceBuffer";

const buffer = createVisualTraceBuffer({
  wallTimeMs: () => Date.now(),
  monotonicMs: () => performance.now(),
  schedule: (callback) => {
    setTimeout(callback, 1000);
  },
  emit: (record) =>
    console.info(
      `[teleport-visual-js] ${JSON.stringify({
        ...record,
        // Preserve the compiled identity literal after the builder stamps it.
        // prettier-ignore
        helperSHA: "__TELEPORT_VISUAL_JS_SHA__",
      })}`,
    ),
});

export function configureVisualTrace(
  requested: boolean,
  identity: VisualTraceIdentity,
) {
  buffer.configure(requested && Platform.OS === "ios", identity);
}

export const visualTraceEnabled = buffer.enabled;

export function traceVisualPress<T>(
  role: "go_next" | "persisted_portal_toggle_host",
  handler: (event?: GestureResponderEvent) => T,
): (event?: GestureResponderEvent) => T {
  if (!buffer.enabled()) return handler;
  return (event) => {
    const touch = event?.nativeEvent;
    buffer.record("onPress.begin", {
      role,
      touchTimestampMs: touch?.timestamp ?? null,
      x: touch?.pageX ?? null,
      y: touch?.pageY ?? null,
      target: touch?.target ?? null,
    });
    try {
      return handler(event);
    } finally {
      buffer.record("onPress.end", { role });
    }
  };
}

export function traceVisualLayout(role: string, state: object = {}) {
  buffer.record("react.layoutEffect", { role, state });
}

export function traceVisualTransition(
  role: string,
  phase: "transitionStart" | "transitionEnd",
  closing: boolean,
) {
  if (
    role === "NAVIGATION_LIFECYCLE" ||
    role === "NAVIGATION_LIFECYCLE_NESTED" ||
    role === "PERSISTED_PORTAL"
  ) {
    buffer.record(`navigation.${phase}.received`, { role, closing });
  }
}
