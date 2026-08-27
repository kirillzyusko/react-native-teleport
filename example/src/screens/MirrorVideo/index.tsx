import { useEffect, useRef, useState } from "react";
import LottieView from "lottie-react-native";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Video, { ViewType } from "react-native-video";
import { Mirror, Portal } from "react-native-teleport";

const TEXTURE_MIRROR_NAME = "mirror-video-texture";
const SURFACE_MIRROR_NAME = "mirror-video-surface";
const LOTTIE_MIRROR_NAME = "mirror-video-lottie";

const textureVideo = require("../Instagram/videos/forest.mp4");
const surfaceVideo = require("../Instagram/videos/squirrel.mp4");
const lottieAnimation = require("../../assets/lottie/bear.json");

type MirrorUseCase = "surface" | "texture" | "lottie";

const MIRROR_USE_CASES: ReadonlyArray<{
  label: string;
  value: MirrorUseCase;
}> = [
  { label: "Surface video", value: "surface" },
  { label: "Texture video", value: "texture" },
  { label: "Lottie", value: "lottie" },
];

type VideoMirrorCaseProps = {
  description: string;
  mirrorName: string;
  paused: boolean;
  source: ReturnType<typeof require>;
  title: string;
  viewType: ViewType;
};

function VideoMirrorCase({
  description,
  mirrorName,
  paused,
  source,
  title,
  viewType,
}: VideoMirrorCaseProps) {
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const status = hasError
    ? "error"
    : isReady
      ? paused
        ? "paused"
        : "playing"
      : "loading";

  return (
    <View style={styles.caseContainer}>
      <View style={styles.caseHeading}>
        <View>
          <Text style={styles.caseTitle}>{title}</Text>
          <Text style={styles.caseDescription}>{description}</Text>
        </View>
        <Text
          style={[
            styles.status,
            isReady && styles.statusReady,
            hasError && styles.statusError,
          ]}
        >
          {status}
        </Text>
      </View>

      <View style={styles.comparisonRow}>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Source Portal</Text>
          <View style={styles.mediaFrame} testID={`${mirrorName}-source`}>
            <Portal name={mirrorName} style={styles.media}>
              <Video
                muted
                onError={() => setHasError(true)}
                onLoad={() => setIsReady(true)}
                paused={paused}
                repeat
                resizeMode="cover"
                source={{ uri: source }}
                style={StyleSheet.absoluteFillObject}
                testID={`${mirrorName}-video`}
                viewType={viewType}
              />
              <View pointerEvents="none" style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>SOURCE VIEW</Text>
              </View>
            </Portal>
          </View>
        </View>

        <View style={styles.column}>
          <Text style={styles.columnLabel}>Mirror</Text>
          <View style={styles.mediaFrame} testID={`${mirrorName}-mirror`}>
            <Mirror name={mirrorName} style={styles.media} />
          </View>
        </View>
      </View>
    </View>
  );
}

type LottieMirrorCaseProps = {
  paused: boolean;
};

function LottieMirrorCase({ paused }: LottieMirrorCaseProps) {
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    if (paused) {
      animationRef.current?.pause();
    } else {
      animationRef.current?.resume();
    }
  }, [paused]);

  return (
    <View style={styles.caseContainer}>
      <View style={styles.caseHeading}>
        <View>
          <Text style={styles.caseTitle}>Lottie</Text>
          <Text style={styles.caseDescription}>
            Native vector animation drawn in the View hierarchy
          </Text>
        </View>
        <Text style={[styles.status, styles.statusReady]}>
          {paused ? "paused" : "animating"}
        </Text>
      </View>

      <View style={styles.comparisonRow}>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Source Portal</Text>
          <View
            style={styles.mediaFrame}
            testID={`${LOTTIE_MIRROR_NAME}-source`}
          >
            <Portal name={LOTTIE_MIRROR_NAME} style={styles.lottieMedia}>
              <LottieView
                autoPlay
                loop
                ref={animationRef}
                source={lottieAnimation}
                style={StyleSheet.absoluteFillObject}
                testID={`${LOTTIE_MIRROR_NAME}-animation`}
              />
              <View pointerEvents="none" style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>SOURCE VIEW</Text>
              </View>
            </Portal>
          </View>
        </View>

        <View style={styles.column}>
          <Text style={styles.columnLabel}>Mirror</Text>
          <View
            style={styles.mediaFrame}
            testID={`${LOTTIE_MIRROR_NAME}-mirror`}
          >
            <Mirror name={LOTTIE_MIRROR_NAME} style={styles.lottieMedia} />
          </View>
        </View>
      </View>
    </View>
  );
}

type ActiveMirrorCaseProps = {
  activeCase: MirrorUseCase;
  paused: boolean;
};

function ActiveMirrorCase({ activeCase, paused }: ActiveMirrorCaseProps) {
  switch (activeCase) {
    case "surface":
      return (
        <VideoMirrorCase
          key="surface"
          description="Decoded into a separate Android surface"
          mirrorName={SURFACE_MIRROR_NAME}
          paused={paused}
          source={surfaceVideo}
          title="SurfaceView"
          viewType={ViewType.SURFACE}
        />
      );
    case "texture":
      return (
        <VideoMirrorCase
          key="texture"
          description="Participates in normal View compositing"
          mirrorName={TEXTURE_MIRROR_NAME}
          paused={paused}
          source={textureVideo}
          title="TextureView"
          viewType={ViewType.TEXTURE}
        />
      );
    case "lottie":
      return <LottieMirrorCase paused={paused} />;
  }
}

export default function MirrorVideo() {
  const [activeCase, setActiveCase] = useState<MirrorUseCase>("surface");
  const [paused, setPaused] = useState(false);

  const selectCase = (nextCase: MirrorUseCase) => {
    setPaused(false);
    setActiveCase(nextCase);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
      testID="mirror-video-screen"
    >
      <Text style={styles.title}>Mirror Video Surfaces</Text>
      <Text style={styles.subtitle}>
        Exactly one use-case is mounted at a time. Switching cases unmounts the
        previous Portal, Mirror, animation, and video player before rendering
        the selected case.
      </Text>
      <Text style={styles.resultHint}>
        SurfaceView is intentionally skipped: its source stays live and its
        Mirror stays empty. For TextureView and Lottie, compare the moving
        pixels in Source Portal and Mirror.
      </Text>

      <View accessibilityRole="tablist" style={styles.caseSelector}>
        {MIRROR_USE_CASES.map((item) => {
          const selected = activeCase === item.value;

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.value}
              onPress={() => selectCase(item.value)}
              style={({ pressed }) => [
                styles.caseSelectorButton,
                selected && styles.caseSelectorButtonSelected,
                pressed && styles.caseSelectorButtonPressed,
              ]}
              testID={`mirror-video-case-${item.value}`}
            >
              <Text
                style={[
                  styles.caseSelectorText,
                  selected && styles.caseSelectorTextSelected,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setPaused((value) => !value)}
        style={({ pressed }) => [
          styles.playbackButton,
          pressed && styles.playbackButtonPressed,
        ]}
        testID="mirror-video-playback-toggle"
      >
        <Text style={styles.playbackButtonText}>
          {paused ? "Play active case" : "Pause active case"}
        </Text>
      </Pressable>

      <ActiveMirrorCase activeCase={activeCase} paused={paused} />

      {Platform.OS !== "android" ? (
        <Text style={styles.platformNote}>
          ViewType is Android-only. Both cases use the platform video view on{" "}
          {Platform.OS}.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 20,
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#4b5563",
    fontSize: 14,
    lineHeight: 20,
  },
  resultHint: {
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    color: "#92400e",
    fontSize: 12,
    lineHeight: 18,
    paddingLeft: 10,
  },
  caseSelector: {
    flexDirection: "row",
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
    padding: 3,
    gap: 3,
  },
  caseSelectorButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  caseSelectorButtonSelected: {
    backgroundColor: "#ffffff",
  },
  caseSelectorButtonPressed: {
    opacity: 0.72,
  },
  caseSelectorText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  caseSelectorTextSelected: {
    color: "#111827",
  },
  playbackButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  playbackButtonPressed: {
    opacity: 0.8,
  },
  playbackButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  caseContainer: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
  },
  caseHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  caseTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  caseDescription: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  status: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    color: "#4b5563",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  statusReady: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusError: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  comparisonRow: {
    flexDirection: "row",
    gap: 10,
  },
  column: {
    flex: 1,
    gap: 6,
  },
  columnLabel: {
    color: "#4b5563",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  mediaFrame: {
    aspectRatio: 16 / 9,
    overflow: "hidden",
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: "#030712",
  },
  media: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#030712",
  },
  lottieMedia: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fef3c7",
  },
  sourceBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    borderRadius: 5,
    backgroundColor: "rgba(17, 24, 39, 0.82)",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  sourceBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  platformNote: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 18,
  },
});
