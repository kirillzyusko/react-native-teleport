import { useState } from "react";
import { TouchableOpacity, View, Text } from "react-native";
import { Portal } from "react-native-teleport";
import BottomSheetContainer from "./sheet";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BottomSheet() {
  const [isVisible, setVisible] = useState(false);

  return (
    <>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 2 }} />
        <View style={{ flex: 1 }}>
          <View style={{ height: 50, flexDirection: "row" }}>
            <View style={{ flex: 1, backgroundColor: "black" }} />
            <TouchableOpacity
              onPress={() => setVisible(true)}
              style={{ flex: 1, backgroundColor: "#3c3c3c" }}
            />
            <View style={{ flex: 1, backgroundColor: "black" }} />
            <Portal hostName="root">
              <BottomSheetContainer visible={isVisible}>
                <SafeAreaView
                  edges={["bottom"]}
                  style={{ padding: 16, backgroundColor: "green" }}
                >
                  <TouchableOpacity onPress={() => setVisible(false)}>
                    <Text>Close</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 22 }}>Sheet</Text>
                </SafeAreaView>
              </BottomSheetContainer>
            </Portal>
          </View>
        </View>
      </View>
    </>
  );
}
