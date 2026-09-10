import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { StyleSheet, View } from "react-native";
import { Portal } from "react-native-teleport";

import { PARKED_HOST, SLOT_HOST } from "./hostName";

const ExpandContext = createContext<() => void>(() => {});

export const useExpand = () => useContext(ExpandContext);

export default function HostProvider({ children }: PropsWithChildren) {
  const [hostName, setHostName] = useState(SLOT_HOST);
  const [redrawNudge, setRedrawNudge] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setRedrawNudge((n) => n + 1), 150);
    return () => clearTimeout(timer);
  }, [hostName]);

  const expand = () => setHostName(PARKED_HOST);

  return (
    <ExpandContext.Provider value={expand}>
      {children}
      <Portal hostName={hostName} style={styles.parked}>
        <View style={redrawNudge % 2 === 0 ? styles.drawn : styles.redrawn}>
          <View style={styles.teleported} testID="repro_teleported" />
        </View>
      </Portal>
    </ExpandContext.Provider>
  );
}

const styles = StyleSheet.create({
  drawn: {
    opacity: 1,
  },
  parked: {
    position: "absolute",
    top: 2000,
    left: 0,
    width: 240,
    height: 120,
  },
  redrawn: {
    opacity: 0.999,
  },
  teleported: {
    width: 240,
    height: 120,
    borderRadius: 8,
    backgroundColor: "crimson",
  },
});
