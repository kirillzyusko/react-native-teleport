import { useRef } from "react";

let __idCounter = 0;

/**
 * Generates an id that stays stable across re-renders of a component instance.
 *
 * @param prefix - Prefix of the generated id.
 * @returns A unique id, such as `uid-1`.
 * @example
 * ```ts
 * const instanceId = useId();
 * ```
 */
export default function useId(prefix = "uid"): string {
  const idRef = useRef<string>("");

  // eslint-disable-next-line react-hooks/refs -- the id is generated once per instance
  if (!idRef.current) {
    const n = ++__idCounter;

    idRef.current = `${prefix}-${n}`;
  }

  // eslint-disable-next-line react-hooks/refs -- the id never changes after the first render
  return idRef.current;
}
