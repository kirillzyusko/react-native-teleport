import { useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  ScrollView,
  Text,
  Pressable,
} from "react-native";
import { Portal, Mirror } from "react-native-teleport";
import type { MirrorMode } from "react-native-teleport";

const images = [
  {
    name: "beach",
    source: require("../Travel/images/beach.png"),
  },
  {
    name: "forest",
    source: require("../Travel/images/forest.png"),
  },
  {
    name: "mountain",
    source: require("../Travel/images/mountain.png"),
  },
  {
    name: "bromo",
    source: require("../Travel/images/bromo.jpg"),
  },
  {
    name: "kuta",
    source: require("../Travel/images/kuta.jpg"),
  },
];

const modes: MirrorMode[] = ["layer", "snapshot", "live"];

const AdaptiveShadowCard = ({
  name,
  source,
  mode,
}: {
  name: string;
  source: ReturnType<typeof require>;
  mode: MirrorMode;
}) => {
  const portalName = `shadow-${name}`;

  return (
    <View style={styles.cardContainer}>
      <Mirror name={portalName} mode={mode} style={styles.shadow} />
      <Portal name={portalName}>
        <Image source={source} style={styles.image} />
      </Portal>
    </View>
  );
};

const AdaptiveShadow = () => {
  const [mode, setMode] = useState<MirrorMode>("layer");

  return (
    <View style={styles.screen}>
      <View style={styles.modePicker}>
        {modes.map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.modeButton, mode === m && styles.modeButtonActive]}
          >
            <Text
              style={[styles.modeText, mode === m && styles.modeTextActive]}
            >
              {m}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.description}>
        {mode === "layer" && "One-time bitmap capture (drawViewHierarchy)"}
        {mode === "snapshot" && "One-time system snapshot (snapshotView)"}
        {mode === "live" && "Continuous capture at display rate"}
      </Text>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {images.map((img) => (
          <AdaptiveShadowCard
            key={img.name}
            name={img.name}
            source={img.source}
            mode={mode}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const CARD_SIZE = 200;
const SHADOW_EXPAND = 30;
const SHADOW_OFFSET_Y = 15;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  modePicker: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
  },
  modeButtonActive: {
    backgroundColor: "#333",
  },
  modeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  modeTextActive: {
    color: "#fff",
  },
  description: {
    textAlign: "center",
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
  },
  scrollContent: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 60,
  },
  cardContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  image: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 24,
  },
  shadow: {
    position: "absolute",
    top: SHADOW_OFFSET_Y,
    left: -SHADOW_EXPAND / 2,
    width: CARD_SIZE + SHADOW_EXPAND,
    height: CARD_SIZE + SHADOW_EXPAND,
    borderRadius: 24,
    opacity: 0.6,
    filter: "blur(20px)",
  },
});

export default AdaptiveShadow;
