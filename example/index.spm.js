import React from "react";
import { AppRegistry, StyleSheet, Text, View } from "react-native";
import { Portal, PortalHost, PortalProvider } from "react-native-teleport";
import { name as appName } from "./app.json";

function App() {
  return (
    <PortalProvider>
      <View style={styles.container}>
        <PortalHost name="spm" />
        <Portal hostName="spm">
          <Text>Teleport SPM build</Text>
        </Portal>
      </View>
    </PortalProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

AppRegistry.registerComponent(appName, () => App);
