import { useRoute } from "@react-navigation/native";
import { useEffect } from "react";

import type { Insets } from "../types";

const insets: Record<string, Insets> = {};

/**
 * Hook for storing info about additional insets. Uses route name (since insets are screen specific)
 * as key and stores it in global object. Designed to be non-reactive to avoid unnecessary re-renders.
 * Values can be read on demand.
 */
const useInsets = () => {
  const { key } = useRoute();

  const setInsets = (newInsets: Insets) => {
    insets[key] = {
      ...insets[key],
      ...newInsets,
    };
  };
  const getInsets = () => insets[key];

  useEffect(() => {
    return () => {
      // do clean-up on component unmount to reduce memory consumption
      insets[key] = {};
    };
  }, []);

  return {
    setInsets,
    getInsets,
  };
};

export default useInsets;
