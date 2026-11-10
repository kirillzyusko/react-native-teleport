import { useLayoutEffect, useRef, useState } from "react";

let nextOrder = 0;

/**
 * Assign opening order when the Portal commits, rather than during render.
 * Concurrent renders may be suspended or abandoned before anything is shown.
 * A module-wide sequence also makes independently rendered subtrees comparable.
 */
export default function useMountOrder() {
  const committedOrder = useRef(0);
  const [order, setOrder] = useState(0);

  useLayoutEffect(() => {
    // Keep the same value when Strict Mode replays layout effects. The update
    // flushes before paint; zero is only the initial, unassigned placeholder.
    if (committedOrder.current === 0) {
      committedOrder.current = ++nextOrder;
      setOrder(committedOrder.current);
    }
  }, []);

  return order;
}
