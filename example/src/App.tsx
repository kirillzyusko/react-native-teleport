import { useState } from "react";
import { View, StyleSheet, Button } from "react-native";
import { PortalProvider, Portal } from "react-native-teleport";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import Bottle from "./assets/bottle.json";

function AppContent() {
  const [shouldBeTeleported, setTeleported] = useState(false);

  return (
    <View style={styles.container}>
      <Portal hostName={shouldBeTeleported ? "root" : undefined}>
        <LottieView source={Bottle} style={styles.box} autoPlay loop />
      </Portal>
      <Button
        title={shouldBeTeleported ? "Move back" : "Move to portal"}
        onPress={() => setTeleported((t) => !t)}
      />
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "#3c3c3c90",
        }}
        pointerEvents="none"
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PortalProvider>
        <AppContent />
      </PortalProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    width: 160,
    height: 160,
    marginVertical: 20,
  },
});
