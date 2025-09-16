import { useRef } from "react";

/**
 * Module-scoped counter shared across the app runtime.
 * (Resets on full page reload; monotonic within a single session.)
 */
let __uidCounter = 0;

export default function useId(prefix = "uid"): string {
  const idRef = useRef<string>("");
  if (!idRef.current) {
    const n = ++__uidCounter;
    idRef.current = `${prefix}-${n}`;
  }
  return idRef.current;
}
