import { Platform, type GestureResponderEvent } from "react-native";
// @ts-expect-error RN 0.81 exposes this diagnostic entry with Flow types only.
import NativePressability from "react-native/Libraries/Pressability/Pressability";

type PressHandler = (event: GestureResponderEvent) => void;
type PressabilityInstance = {
  _config: { onPress?: PressHandler };
  _touchState: string;
  _responderRegion: Record<string, number> | null;
  _receiveSignal(signal: string, event: GestureResponderEvent): void;
};

let enabled = false;
const roles = new WeakMap<PressHandler, string>();
const events: object[] = [];
let droppedEvents = 0;
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function record(phase: string, details: object) {
  if (events.length < 256) {
    events.push({ at: new Date().toISOString(), phase, ...details });
  } else {
    droppedEvents += 1;
  }
  if (flushTimer !== undefined) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    for (const entry of events.splice(0)) {
      console.info(`[teleport-input] ${JSON.stringify(entry)}`);
    }
    if (droppedEvents) {
      console.info(
        `[teleport-input] ${JSON.stringify({ phase: "overflow", droppedEvents })}`,
      );
      droppedEvents = 0;
    }
  }, 1000);
}

function touch(event?: GestureResponderEvent) {
  if (!event) return null;
  const { pageX, pageY, timestamp, identifier } = event.nativeEvent;
  return { pageX, pageY, timestamp, identifier };
}

export function configureInputTrace(requested: boolean) {
  if (enabled || !requested || Platform.OS !== "android") return;
  const prototype = (NativePressability as { prototype: PressabilityInstance })
    .prototype;
  const receiveSignal = prototype._receiveSignal;
  if (typeof receiveSignal !== "function") {
    throw new Error("Unsupported Pressability implementation for input trace");
  }
  enabled = true;
  prototype._receiveSignal = function (
    this: PressabilityInstance,
    signal,
    event,
  ) {
    const handler = this._config.onPress;
    const role = handler && roles.get(handler);
    if (role) {
      record("signal.before", {
        role,
        signal,
        state: this._touchState,
        region: this._responderRegion && { ...this._responderRegion },
        touch: touch(event),
      });
    }
    const result = receiveSignal.call(this, signal, event);
    if (role) record("signal.after", { role, signal, state: this._touchState });
    return result;
  };
  record("installed", { reactNative: "0.81.0", buffered: true });
}

export function tracePress(role: string, handler: PressHandler): PressHandler {
  // Restrict JS tracing to the exact menu item missed in the real CI failure.
  if (!enabled || role !== "stable_host_remount") return handler;
  const traced: PressHandler = (event) => {
    record("onPress", { role, touch: touch(event) });
    handler(event);
    record("onPress.returned", { role });
  };
  roles.set(traced, role);
  return traced;
}
