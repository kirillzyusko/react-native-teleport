import { View, StyleSheet, Dimensions } from "react-native";
import { Portal } from "react-native-teleport";
import { WebView } from "react-native-webview";

import { useEditorStore } from "./useEditorStore";
import { EDITOR_HTML } from "./editorHtml";

const { width } = Dimensions.get("window");

export default function PreloadedEditor() {
  const hostName = useEditorStore((s) => s.hostName);
  const setReady = useEditorStore((s) => s.setReady);

  return (
    <View style={styles.offscreen}>
      <Portal hostName={hostName} style={{ width }}>
        <WebView
          source={{ html: EDITOR_HTML }}
          style={styles.webview}
          onLoadEnd={() => setReady(true)}
        />
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: "absolute",
    top: -9999,
    height: 500,
  },
  webview: {
    flex: 1,
  },
});
