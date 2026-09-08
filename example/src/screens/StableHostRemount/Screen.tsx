import { StyleSheet, View } from "react-native";
import { PortalHost } from "react-native-teleport";

import { SLOT_HOST } from "./hostName";

export default function Screen() {
  return (
    <View style={styles.screen} testID="repro_screen">
      <PortalHost name={SLOT_HOST} style={styles.host} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  host: {
    flex: 1,
  },
});
