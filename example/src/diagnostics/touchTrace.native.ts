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
  console.info(
    `[teleport-touch] ${JSON.stringify({ at: new Date().toISOString(), phase, ...details })}`,
  );
}

export function tracePress(role: string, handler: PressHandler): PressHandler {
  if (!enabled) return handler;
  const traced: PressHandler = (event) => {
    traceState("onPress", { role, touch: touchDetails(event) });
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
    if (role) {
      traceState("signal.before", {
        role,
        signal,
        state: this._touchState,
        region: this._responderRegion,
        touch: touchDetails(event),
      });
    }
    const result = receiveSignal.call(this, signal, event);
    if (role) {
      traceState("signal.after", {
        role,
        signal,
        state: this._touchState,
        region: this._responderRegion,
      });
    }
    return result;
  };
  traceState("installed", { reactNative: "0.81.0" });
}
