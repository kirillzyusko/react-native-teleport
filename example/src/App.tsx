import { StyleSheet } from "react-native";
import { PortalHost, PortalProvider } from "react-native-teleport";
import { HeroOverlay } from "./screens/Travel/hero";
import { PortalProvider as GorhomPortalProvider } from "@gorhom/portal";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import RootStack from "./navigation";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={styles.container}>
        <GorhomPortalProvider>
          <PortalProvider>
            <NavigationContainer>
              <RootStack />
            </NavigationContainer>
            <PortalHost name="overlay" style={StyleSheet.absoluteFillObject} />
            <HeroOverlay />
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
