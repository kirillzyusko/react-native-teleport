import React, { useContext } from "react";

import { makeMutable, type SharedValue } from "react-native-reanimated";
import type { Destination } from "../types";

type TeleportContextType = {
  progress: SharedValue<number>;
  destination: SharedValue<Destination>;
  setDestination: (
    destination: Partial<Destination>,
    callback?: () => void,
  ) => void;
  resetDestination: () => void;
};

export const defaultDestination: Destination = {
  overflow: {
    top: 0,
    height: 0,
    bottom: 0,
  },
  anchor: {
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  },
  top: 0,
};
const defaultContext: TeleportContextType = {
  progress: makeMutable(0),
  destination: makeMutable(defaultDestination),
  setDestination: () => {},
  resetDestination: () => {},
};

export const TeleportContext = React.createContext(defaultContext);
export const useTeleport = () => useContext(TeleportContext);
