import { useCallback, useEffect, useRef } from "react";

export function useIsMountedRef() {
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}

export function useEvent<T extends (...args: never[]) => unknown>(handler: T): T {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  return useCallback(((...args: Parameters<T>) => {
    return handlerRef.current(...args);
  }) as T, []);
}
