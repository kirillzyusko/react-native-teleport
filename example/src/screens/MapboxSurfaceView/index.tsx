import { StyleSheet, Text, View } from "react-native";

export default function MapboxSurfaceView() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Android-only reproduction</Text>
      <Text style={styles.body}>
        Mapbox uses GLSurfaceView only on Android. Open this example in the
        Android app to exercise native surface reparenting.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  container: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700",
  },
});
