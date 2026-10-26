import type { GestureResponderEvent } from "react-native";

type PressHandler = (event: GestureResponderEvent) => void;

export function tracePress(_role: string, handler: PressHandler): PressHandler {
  return handler;
}

export function traceState(
  _phase: string,
  _details: Record<string, unknown>,
): void {}
