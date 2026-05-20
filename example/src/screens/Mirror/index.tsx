import LottieView from "lottie-react-native";
import { StyleSheet, Text, View } from "react-native";
import { Mirror, Portal } from "react-native-teleport";

const MIRROR_NAME = "lottie-replica";
const SIZE = 220;

export default function MirrorExample() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Lottie Mirror</Text>

      <View style={styles.row}>
        <View style={styles.preview}>
          <Mirror name={MIRROR_NAME} style={styles.animation} />
        </View>

        <Portal name={MIRROR_NAME} style={styles.preview}>
          <LottieView
            source={require("../../assets/lottie/bear.json")}
            style={styles.animation}
            autoPlay
            loop
          />
        </Portal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f6f7f9",
    gap: 28,
    paddingHorizontal: 24,
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  preview: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  animation: {
    width: SIZE,
    height: SIZE,
  },
});
