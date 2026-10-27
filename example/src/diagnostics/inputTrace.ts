import type { GestureResponderEvent } from "react-native";

export function configureInputTrace(_requested: boolean): void {}

export function tracePress(
  _role: string,
  handler: (event: GestureResponderEvent) => void,
) {
  return handler;
}
