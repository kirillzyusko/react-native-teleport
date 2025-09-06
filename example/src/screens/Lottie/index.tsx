import { useState } from "react";
import { View, StyleSheet, Button } from "react-native";
import { Portal, PortalHost } from "react-native-teleport";
import LottieView from "lottie-react-native";
import Bottle from "../../assets/bottle.json";
import {
  GestureHandlerRootView,
  TouchableOpacity,
} from "react-native-gesture-handler";

export default function AppContent() {
  const [shouldBeTeleported, setTeleported] = useState(false);

  return (
    <>
      <View style={styles.container}>
        <Portal hostName={shouldBeTeleported ? "local" : undefined}>
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
        <PortalHost name="local" />
      </View>
    </>
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
