import { View } from "react-native";
import { Portal, PortalHost } from "react-native-teleport";

export default function PortalBeforeHostExample() {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: "green" }}>
        <Portal hostName="bottom">
          <View style={{ width: 50, height: 50, backgroundColor: "red" }} />
        </Portal>
      </View>
      <View style={{ flex: 1, backgroundColor: "blue" }}>
        <PortalHost name="bottom" style={{ flex: 1 }} />
      </View>
    </View>
  );
}
