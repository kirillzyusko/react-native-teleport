import { useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Portal } from "react-native-teleport";

function Player() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const player = (
    <Pressable
      onPress={() => setIsFullscreen((value) => !value)}
      style={styles.player}
      testID="orientation_toggle"
    >
      <Text style={styles.title}>Orientation</Text>
      <Text style={styles.subtitle}>
        {isFullscreen ? "Fullscreen" : "Tap to enter fullscreen"}
      </Text>
      <Text style={styles.rightEdge} testID="orientation_right_edge">
        RIGHT EDGE
      </Text>
    </Pressable>
  );

  return (
    <Portal hostName={isFullscreen ? "root" : undefined} style={styles.portal}>
      {player}
    </Portal>
  );
}

export default function Orientation() {
  // Keep these dimensions outside Player so toggling fullscreen does not read
  // them again. This matches the issue https://github.com/kirillzyusko/react-native-teleport/issues/156 repro.
  const { height, width } = Dimensions.get("screen");
  const containerStyle = { height: height * 0.8, width, padding: 12 };

  return (
    <View style={styles.screen}>
      <View style={containerStyle}>
        <Player />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  player: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderColor: "#000",
    borderWidth: StyleSheet.hairlineWidth,
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  portal: { flex: 1 },
  rightEdge: {
    color: "#fff",
    fontSize: 10,
    opacity: 0.7,
    position: "absolute",
    right: 8,
    top: 8,
  },
  screen: { flex: 1 },
  subtitle: { color: "#fff", fontSize: 16, marginTop: 8, opacity: 0.85 },
  title: { color: "#fff", fontSize: 28, fontWeight: "700" },
});
