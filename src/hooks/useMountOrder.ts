import { useRef } from "react";

let nextOrder = 0;

/** Stable for a Portal's lifetime, including rerenders and manual reordering. */
export default function useMountOrder() {
  const order = useRef(0);
  if (order.current === 0) order.current = ++nextOrder;
  return order.current;
}
