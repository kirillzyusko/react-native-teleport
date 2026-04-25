import { StyleSheet } from "react-native";
import { PortalHost, PortalProvider } from "react-native-teleport";
import { PortalProvider as GorhomPortalProvider } from "@gorhom/portal";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import RootStack from "./navigation";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import PreloadedEditor from "./screens/RichTextEditor/PreloadedEditor";
import { ContextMenuTeleportProvider } from "./components/context-menu";

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={styles.container}>
        <GorhomPortalProvider>
          <PortalProvider>
            <ContextMenuTeleportProvider>
              <NavigationContainer>
                <RootStack />
              </NavigationContainer>
            </ContextMenuTeleportProvider>
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
});
