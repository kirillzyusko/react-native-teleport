import { useState } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Portal } from "react-native-teleport";
import BottomSheetContainer from "./sheet";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "./slider";

export default function BottomSheet() {
  const [isVisible, setVisible] = useState(false);

  return (
    <>
      <View style={styles.flex1}>
        <View style={styles.flex2} />
        <View style={styles.flex1}>
          <View style={styles.row}>
            <View style={styles.column} />
            <TouchableOpacity
              onPress={() => setVisible(true)}
              style={styles.button}
            >
              <Portal hostName="root">
                <BottomSheetContainer visible={isVisible}>
                  <SafeAreaView edges={["bottom"]} style={styles.bottomSheet}>
                    <TouchableOpacity onPress={() => setVisible(false)}>
                      <Text>Close</Text>
                    </TouchableOpacity>
                    <Slider />
                    <Text style={styles.title}>Sheet</Text>
                  </SafeAreaView>
                </BottomSheetContainer>
              </Portal>
            </TouchableOpacity>
            <View style={styles.column} />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  column: {
    flex: 1,
    backgroundColor: "black",
  },
  row: {
    height: 50,
    flexDirection: "row",
  },
  button: {
    width: 20,
    backgroundColor: "#3c3c3c",
  },
  bottomSheet: {
    padding: 16,
    backgroundColor: "green",
  },
  title: {
    fontSize: 32,
  },
});
