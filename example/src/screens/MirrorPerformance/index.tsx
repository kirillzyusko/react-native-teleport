import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import LottieView from "lottie-react-native";
import { Mirror, Portal } from "react-native-teleport";

const TOTAL = 100;
const COLS = 8;
const CELL = 40;
const GAP = 3;

const lottieSource = require("../../assets/lottie/bear.json");

type Mode = "lottie" | "mirror";

function LottieGrid() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: TOTAL }, (_, i) => (
        <LottieView
          key={i}
          source={lottieSource}
          style={styles.cell}
          autoPlay
          loop
        />
      ))}
    </View>
  );
}

function MirrorGrid() {
  return (
    <View style={styles.grid}>
      <Portal name="perf-lottie" style={styles.cell}>
        <LottieView
          source={lottieSource}
          style={styles.cell}
          autoPlay
          loop
        />
      </Portal>

      {Array.from({ length: TOTAL - 1 }, (_, i) => (
        <Mirror key={i} name="perf-lottie" style={styles.cell} />
      ))}
    </View>
  );
}

export default function MirrorPerformance() {
  const [mode, setMode] = useState<Mode>("lottie");

  const toggle = useCallback(
    () => setMode((m) => (m === "lottie" ? "mirror" : "lottie")),
    [],
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      <Text style={styles.title}>Mirror Performance</Text>
      <Text style={styles.subtitle}>
        {mode === "lottie"
          ? `${TOTAL} Lottie instances`
          : `1 Lottie + ${TOTAL - 1} Mirrors`}
      </Text>

      <View style={styles.buttons}>
        <Pressable
          style={[styles.tab, mode === "lottie" && styles.tabActive]}
          onPress={() => setMode("lottie")}
        >
          <Text
            style={[
              styles.tabText,
              mode === "lottie" && styles.tabTextActive,
            ]}
          >
            {TOTAL} Lottie
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === "mirror" && styles.tabActive]}
          onPress={() => setMode("mirror")}
        >
          <Text
            style={[
              styles.tabText,
              mode === "mirror" && styles.tabTextActive,
            ]}
          >
            1 + {TOTAL - 1} Mirror
          </Text>
        </Pressable>
      </View>

      {mode === "lottie" ? <LottieGrid /> : <MirrorGrid />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f6f7f9" },
  container: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  buttons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  tabActive: {
    backgroundColor: "#111827",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    width: COLS * CELL + (COLS - 1) * GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
  },
});
