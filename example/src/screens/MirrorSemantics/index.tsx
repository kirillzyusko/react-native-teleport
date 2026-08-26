import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Mirror, Portal } from "react-native-teleport";

const MIRROR_NAME = "mirror-semantics-artwork";
const SOURCE_WIDTH = 300;
const SOURCE_HEIGHT = 400;
const CLIPPED_SIZE = 150;

function CornerMarker({ label, style }: { label: string; style: object }) {
  return (
    <View
      accessibilityLabel={`${label} corner marker`}
      style={[styles.cornerMarker, style]}
    >
      <Text style={styles.cornerLabel}>{label}</Text>
    </View>
  );
}

function SourceArtwork() {
  return (
    <View style={styles.artwork}>
      <View style={[styles.quadrant, styles.topLeft]} />
      <View style={[styles.quadrant, styles.topRight]} />
      <View style={[styles.quadrant, styles.bottomLeft]} />
      <View style={[styles.quadrant, styles.bottomRight]} />
      <View style={styles.centerCard}>
        <Text style={styles.centerTitle}>PORTAL SUBTREE</Text>
        <Text style={styles.centerText}>300 × 400</Text>
      </View>
      <CornerMarker label="TL" style={styles.markerTopLeft} />
      <CornerMarker label="TR" style={styles.markerTopRight} />
      <CornerMarker label="BL" style={styles.markerBottomLeft} />
      <CornerMarker label="BR" style={styles.markerBottomRight} />
    </View>
  );
}

export default function MirrorSemantics() {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
      testID="mirror-semantics-screen"
    >
      <Text style={styles.title}>External opacity & clipping</Text>
      <Text style={styles.description}>
        The named Portal is 300 × 400, but its external ancestor is invisible
        and clips at 150 × 150. Mirror still copies the complete Portal subtree.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SOURCE ANCESTOR</Text>
        <Text
          accessibilityLabel="Source ancestor is 150 by 150, opacity zero, overflow hidden"
          style={styles.statusText}
          testID="mirror-semantics-source-status"
        >
          150 × 150 · opacity: 0 · overflow: hidden
        </Text>

        <View style={styles.sourceStage}>
          <View style={styles.visibleClipGuide} pointerEvents="none">
            <Text style={styles.guideText}>external clip bounds</Text>
          </View>
          <View
            style={styles.invisibleClippingAncestor}
            testID="mirror-semantics-clipped-source"
          >
            <Portal
              name={MIRROR_NAME}
              style={{ width: SOURCE_WIDTH, height: SOURCE_HEIGHT }}
            >
              <SourceArtwork />
            </Portal>
          </View>
        </View>
      </View>

      <View style={styles.connector}>
        <View style={styles.connectorLine} />
        <Text style={styles.connectorText}>
          Mirror copies named Portal only
        </Text>
        <View style={styles.connectorLine} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>MIRROR OUTPUT</Text>
        <Text
          accessibilityLabel="Mirror is 300 by 400 and all four corner markers are visible"
          style={styles.statusText}
          testID="mirror-semantics-output-status"
        >
          300 × 400 · expect TL + TR + BL + BR
        </Text>
        <View style={styles.mirrorOutline}>
          <Mirror
            name={MIRROR_NAME}
            style={{ width: SOURCE_WIDTH, height: SOURCE_HEIGHT }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2efe8",
  },
  content: {
    alignItems: "center",
    paddingBottom: 40,
    paddingHorizontal: 18,
    paddingTop: 24,
  },
  title: {
    color: "#17201e",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: "#5c625f",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    marginTop: 8,
    maxWidth: 340,
    textAlign: "center",
  },
  section: {
    alignItems: "center",
  },
  sectionLabel: {
    color: "#27685d",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  statusText: {
    color: "#464c49",
    fontSize: 12,
    marginBottom: 12,
    marginTop: 5,
  },
  sourceStage: {
    height: CLIPPED_SIZE,
    position: "relative",
    width: CLIPPED_SIZE,
  },
  visibleClipGuide: {
    alignItems: "center",
    borderColor: "#d05a3f",
    borderRadius: 10,
    borderStyle: "dashed",
    borderWidth: 2,
    height: CLIPPED_SIZE,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    top: 0,
    width: CLIPPED_SIZE,
    zIndex: 2,
  },
  guideText: {
    backgroundColor: "#f2efe8",
    color: "#b34831",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 5,
  },
  invisibleClippingAncestor: {
    height: CLIPPED_SIZE,
    opacity: 0,
    overflow: "hidden",
    width: CLIPPED_SIZE,
  },
  connector: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginVertical: 20,
    width: 300,
  },
  connectorLine: {
    backgroundColor: "#9cbab4",
    flex: 1,
    height: 1,
  },
  connectorText: {
    color: "#27685d",
    fontSize: 11,
    fontWeight: "700",
  },
  mirrorOutline: {
    backgroundColor: "#ffffff",
    borderColor: "#27685d",
    borderRadius: 3,
    borderWidth: 2,
    height: SOURCE_HEIGHT + 4,
    overflow: "hidden",
    padding: 0,
    width: SOURCE_WIDTH + 4,
  },
  artwork: {
    backgroundColor: "#fffaf0",
    height: SOURCE_HEIGHT,
    overflow: "hidden",
    position: "relative",
    width: SOURCE_WIDTH,
  },
  quadrant: {
    height: "50%",
    position: "absolute",
    width: "50%",
  },
  topLeft: {
    backgroundColor: "#ef6b57",
    left: 0,
    top: 0,
  },
  topRight: {
    backgroundColor: "#f0c75e",
    right: 0,
    top: 0,
  },
  bottomLeft: {
    backgroundColor: "#5bb49e",
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    backgroundColor: "#5378c8",
    bottom: 0,
    right: 0,
  },
  centerCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "rgba(20,35,31,0.2)",
    borderRadius: 12,
    borderWidth: 1,
    left: 70,
    paddingVertical: 14,
    position: "absolute",
    top: 164,
    width: 160,
  },
  centerTitle: {
    color: "#17201e",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  centerText: {
    color: "#5c625f",
    fontSize: 12,
    marginTop: 3,
  },
  cornerMarker: {
    alignItems: "center",
    backgroundColor: "#17201e",
    borderColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    width: 36,
  },
  cornerLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  markerTopLeft: {
    left: 12,
    top: 12,
  },
  markerTopRight: {
    right: 12,
    top: 12,
  },
  markerBottomLeft: {
    bottom: 12,
    left: 12,
  },
  markerBottomRight: {
    bottom: 12,
    right: 12,
  },
});
