import { StyleSheet, View } from "react-native";
import { PortalHost, PortalProvider } from "react-native-teleport";
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
        <PortalProvider>
          <NavigationContainer>
            <RootStack />
          </NavigationContainer>
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            <PortalHost name="overlay" />
          </View>
        </PortalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
