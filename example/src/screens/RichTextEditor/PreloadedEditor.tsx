import { View, StyleSheet, Dimensions } from "react-native";
import { Portal } from "react-native-teleport";
import { WebView } from "react-native-webview";

import { EDITOR_HTML } from "./editorHtml";

const { width, height } = Dimensions.get("window");

export default function PreloadedEditor() {
  return (
    <View style={styles.offscreen}>
      <Portal hostName="editor" style={styles.portal}>
        <WebView source={{ html: EDITOR_HTML }} style={styles.webview} />
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: "absolute",
    top: -9999,
  },
  portal: {
    width: width,
    height: height,
  },
  webview: {
    flex: 1,
  },
});
