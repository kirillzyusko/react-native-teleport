import { useState } from "react";
import { View, StyleSheet, Button, TouchableOpacity } from "react-native";
import { PortalProvider, Portal, PortalHost } from "react-native-teleport";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { NavigationContainer } from "@react-navigation/native";
import Bottle from "./assets/bottle.json";
import RootStack from "./navigation";
import {
  GestureHandlerRootView,
  // TouchableOpacity,
} from "react-native-gesture-handler";

function AppContent() {
  const [shouldBeTeleported, setTeleported] = useState(false);

  return (
    <>
      <View style={styles.container}>
        <Portal hostName={shouldBeTeleported ? "root2" : undefined}>
          <GestureHandlerRootView>
            <TouchableOpacity>
              <LottieView source={Bottle} style={styles.box} autoPlay loop />
            </TouchableOpacity>
          </GestureHandlerRootView>
        </Portal>
        <Button
          title={shouldBeTeleported ? "Move back" : "Move to portal"}
          onPress={() => setTeleported((t) => !t)}
        />
        {/*<View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "#3c3c3c90",
          }}
          pointerEvents="none"
        />*/}
      </View>
      <View style={{ width: 160, height: 160 }}>
        <PortalHost name="root2" />
      </View>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PortalProvider>
          <NavigationContainer>
            <RootStack />
          </NavigationContainer>
          {/*<AppContent />
          <View style={StyleSheet.absoluteFillObject}>
            <PortalHost name="root3" />
          </View>*/}
        </PortalProvider>
      </GestureHandlerRootView>
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
