import { Platform, Settings, type GestureResponderEvent } from "react-native";
// @ts-expect-error RN 0.81 exposes this diagnostic entry with Flow types only.
import NativePressability from "react-native/Libraries/Pressability/Pressability";

type PressHandler = (event: GestureResponderEvent) => void;
type PressabilityInstance = {
  _config: { onPress?: PressHandler };
  _touchState: string;
  _responderRegion: Record<string, number> | null;
  _receiveSignal(signal: string, event: GestureResponderEvent): void;
};

// Enabled only by the dedicated CI profile before React Native starts.
const enabled = Platform.OS === "ios" && Settings.get("TeleportTouchTrace");
const roles = new WeakMap<PressHandler, string>();
const activePresses = new Set<PressabilityInstance>();
const events: { capturedAt: number; phase: string; details: object }[] = [];
let droppedEvents = 0;
let openCount = 0;
let closeCount = 0;
let finished = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function emit(phase: string, details: object, capturedAt = Date.now()) {
  console.info(
    `[teleport-touch] ${JSON.stringify({ at: new Date(capturedAt).toISOString(), phase, ...details })}`,
  );
}

function flushAfter(delay: number) {
  if (flushTimer !== undefined) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    // Keep native console I/O outside the press state machine and active moves.
    if (activePresses.size) {
      flushAfter(250);
      return;
    }
    for (const event of events.splice(0)) {
      emit(event.phase, event.details, event.capturedAt);
    }
    if (droppedEvents) {
      emit("overflow", { droppedEvents });
      droppedEvents = 0;
    }
  }, delay);
}

function targetDescription(target: unknown) {
  return typeof target === "number" || typeof target === "string"
    ? target
    : typeof target;
}

function touchDetails(event?: GestureResponderEvent) {
  if (!event) return null;
  const pick = (touch: GestureResponderEvent["nativeEvent"]) => ({
    identifier: touch.identifier,
    timestamp: touch.timestamp,
    pageX: touch.pageX,
    pageY: touch.pageY,
    locationX: touch.locationX,
    locationY: touch.locationY,
    target: targetDescription(touch.target),
  });
  return {
    ...pick(event.nativeEvent),
    changedTouches: event.nativeEvent.changedTouches?.map(pick),
    touches: event.nativeEvent.touches?.map(pick),
  };
}

export function traceState(phase: string, details: Record<string, unknown>) {
  if (!enabled) return;
  if (events.length < 4096) {
    events.push({ capturedAt: Date.now(), phase, details });
  } else {
    droppedEvents += 1;
  }
  if (finished) flushAfter(0);
}

export function tracePress(role: string, handler: PressHandler): PressHandler {
  if (!enabled) return handler;
  const traced: PressHandler = (event) => {
    traceState("onPress", { role, touch: touchDetails(event) });
    if (role === "bottom-sheet.open" && ++openCount === 2) {
      // Preserve evidence even if the final swipe never reaches Close.
      flushAfter(8000);
    }
    handler(event);
  };
  roles.set(traced, role);
  return traced;
}

if (enabled) {
  const prototype = (NativePressability as { prototype: PressabilityInstance })
    .prototype;
  const receiveSignal = prototype._receiveSignal;
  if (typeof receiveSignal !== "function") {
    throw new Error("Unsupported Pressability implementation for touch trace");
  }
  prototype._receiveSignal = function (
    this: PressabilityInstance,
    signal,
    event,
  ) {
    const handler = this._config.onPress;
    const role = handler && roles.get(handler);
    if (role && signal === "RESPONDER_GRANT") activePresses.add(this);
    if (role) {
      traceState("signal.before", {
        role,
        signal,
        state: this._touchState,
        region: this._responderRegion && { ...this._responderRegion },
        touch: touchDetails(event),
      });
    }
    try {
      const result = receiveSignal.call(this, signal, event);
      if (role) {
        traceState("signal.after", {
          role,
          signal,
          state: this._touchState,
          region: this._responderRegion && { ...this._responderRegion },
        });
      }
      return result;
    } finally {
      if (
        role &&
        (signal === "RESPONDER_RELEASE" || signal === "RESPONDER_TERMINATED")
      ) {
        activePresses.delete(this);
        if (role === "bottom-sheet.close" && ++closeCount === 2) {
          finished = true;
          flushAfter(0);
        }
      }
    }
  };
  emit("installed", { reactNative: "0.81.0", buffered: true });
}
