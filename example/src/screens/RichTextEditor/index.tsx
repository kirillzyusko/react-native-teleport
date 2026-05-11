import { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { PortalHost } from "react-native-teleport";
import { WebView } from "react-native-webview";

import { EDITOR_HTML } from "./editorHtml";

type Mode = "idle" | "standard" | "preloaded";

export default function RichTextEditorExample() {
  const [mode, setMode] = useState<Mode>("idle");
  const [standardReady, setStandardReady] = useState(false);

  const openPreloaded = useCallback(() => {
    setMode("preloaded");
  }, []);

  const openStandard = useCallback(() => {
    setMode("standard");
    setStandardReady(false);
  }, []);

  const close = useCallback(() => {
    setMode("idle");
  }, []);

  if (mode === "idle") {
    return (
      <View style={styles.container}>
        <View style={styles.info}>
          <Text style={styles.description}>
            A WebView-based rich text editor is pre-loaded offscreen at app
            startup. When you open it with Teleport, the editor appears
            instantly. Compare this to the standard approach, which loads the
            WebView from scratch.
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, styles.dotReady]} />
            <Text style={styles.statusText}>
              {"Editor pre-loaded and ready"}
            </Text>
          </View>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.card} onPress={openStandard}>
            <Text style={styles.cardTitle}>Standard</Text>
            <Text style={styles.cardDesc}>
              Mounts a fresh WebView when opened. You will see a loading spinner
              while the editor downloads and initializes.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.cardHighlight]}
            onPress={openPreloaded}
          >
            <Text style={[styles.cardTitle, styles.cardTitleHighlight]}>
              Pre-loaded (Teleport)
            </Text>
            <Text style={[styles.cardDesc, styles.cardDescHighlight]}>
              The editor was loaded offscreen at startup. Tapping this teleports
              it in with zero loading time.
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.editorHeader}>
        <TouchableOpacity onPress={close} style={styles.backButton}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.editorLabel}>
          {mode === "preloaded" ? "Pre-loaded Editor" : "Standard Editor"}
        </Text>
      </View>

      {mode === "preloaded" && (
        <PortalHost name="editor" style={styles.editor} />
      )}

      {mode === "standard" && (
        <View style={styles.editor}>
          {!standardReady && (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading editor...</Text>
            </View>
          )}
          <WebView
            source={{ html: EDITOR_HTML }}
            style={!standardReady ? styles.hidden : styles.flex1}
            onLoadEnd={() => setStandardReady(true)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  info: {
    padding: 16,
    gap: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#3c3c43",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF9500",
  },
  dotReady: {
    backgroundColor: "#34C759",
  },
  statusText: {
    fontSize: 13,
    color: "#8e8e93",
  },
  buttons: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHighlight: {
    backgroundColor: "#007AFF",
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  cardTitleHighlight: {
    color: "#ffffff",
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6c6c70",
  },
  cardDescHighlight: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#c6c6c8",
    backgroundColor: "#ffffff",
  },
  backButton: {
    paddingRight: 12,
  },
  backText: {
    fontSize: 17,
    color: "#007AFF",
  },
  editorLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
  },
  editor: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    zIndex: 1,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#8e8e93",
  },
  hidden: {
    position: "absolute",
    opacity: 0,
    height: 0,
  },
  flex1: {
    flex: 1,
  },
});
