import { PortalProvider as GorhomPortalProvider } from "@gorhom/portal";
import { NavigationContainer } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { PortalHost, PortalProvider } from "react-native-teleport";

import RootStack from "./navigation";
import PreloadedEditor from "./screens/RichTextEditor/PreloadedEditor";

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={styles.container}>
        <GorhomPortalProvider>
          <PortalProvider>
            <NavigationContainer>
              <RootStack />
            </NavigationContainer>
            <PortalHost name="overlay" style={StyleSheet.absoluteFill} />
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
