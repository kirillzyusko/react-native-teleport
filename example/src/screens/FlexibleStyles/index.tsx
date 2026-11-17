import {
  Portal as GorhomPortal,
  PortalHost as GorhomPortalHost,
} from "@gorhom/portal";
import { useState } from "react";
import { Button, StyleSheet, View } from "react-native";
import { Portal, PortalHost } from "react-native-teleport";

export default function FlexibleStyles() {
  const [destination, setDestination] = useState<string>();
  const [gorhom, setGorhom] = useState<string>();

  return (
    <View style={{ flex: 1 }}>
      <Button title="Overlay" onPress={() => setDestination("flex")} />
      <Button title="Back" onPress={() => setDestination(undefined)} />
      <Button
        title="Gorhom Overlay"
        onPress={() => setGorhom("gorhom-overlay")}
      />
      <Button title="Gorhom Back" onPress={() => setGorhom(undefined)} />
      <View style={{ flex: 1, backgroundColor: "red" }} />
      <View style={{ flex: 1, backgroundColor: "green" }}>
        <View style={{ width: 50, height: 50 }}>
          {gorhom && (
            <GorhomPortal hostName={gorhom}>
              <View
                style={{
                  flex: 1,
                  width: "100%",
                  height: "100%",
                  backgroundColor: "purple",
                }}
              />
            </GorhomPortal>
          )}
        </View>
      </View>
      <View style={{ flex: 1, backgroundColor: "blue" }}>
        <View style={{ width: 50, height: 50 }}>
          <Portal hostName={destination} style={{ flex: 1 }}>
            <View
              style={{
                flex: 1,
                width: "100%",
                height: "100%",
                backgroundColor: "yellow",
              }}
              testID="teleport"
            />
          </Portal>
        </View>
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <PortalHost name="flex" style={{ flex: 1, display: "flex" }} />
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <GorhomPortalHost name="gorhom-overlay" />
      </View>
    </View>
  );
}
