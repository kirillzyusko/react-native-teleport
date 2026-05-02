import { StyleSheet, Text, View } from "react-native";
import { Portal, PortalHost, PortalProvider } from "react-native-teleport";
import { PortalProvider as GorhomPortalProvider } from "@gorhom/portal";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import RootStack from "./navigation";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import PreloadedEditor from "./screens/RichTextEditor/PreloadedEditor";
import { PERSISTED_PORTAL_HOST } from "./screens/PersistedPortal/hostName";

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={styles.container}>
        <GorhomPortalProvider>
          <PortalProvider>
            <Portal hostName={PERSISTED_PORTAL_HOST}>
              <View style={styles.persistedTeleported}>
                <Text style={styles.persistedTeleportedText}>
                  TELEPORTED CONTENT
                </Text>
              </View>
            </Portal>
            <NavigationContainer>
              <RootStack />
            </NavigationContainer>
            <PortalHost name="overlay" style={StyleSheet.absoluteFillObject} />
            <PreloadedEditor />
          </PortalProvider>
        </GorhomPortalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  persistedTeleported: {
    width: 240,
    height: 80,
    backgroundColor: "crimson",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    alignSelf: "center",
    marginTop: 8,
  },
  persistedTeleportedText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
});
