import { ScrollView, View } from "react-native";
import { PortalHost } from "react-native-teleport";

export default function Reels() {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView>
        <PortalHost name="reels" />
      </ScrollView>
    </View>
  );
}
