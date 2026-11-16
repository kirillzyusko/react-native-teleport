import { useState } from "react";

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
  const [id] = useState(() => `${prefix}-${++__idCounter}`);

  return id;
}
