import { useEffect } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Portal } from "react-native-teleport";
import { useTour } from "./TourContext";

const TIP_WIDTH = 280;
const TIP_GAP = 16;
const SCREEN_WIDTH = Dimensions.get("window").width;

export default function TourOverlay() {
  const { step, activeId, layouts, next, stop, stepIndex, totalSteps } =
    useTour();
  const insets = useSafeAreaInsets();

  const visible = step !== null;
  const layout = activeId ? layouts[activeId] : undefined;

  const overlayOpacity = useSharedValue(0);
  const tipX = useSharedValue(SCREEN_WIDTH / 2 - TIP_WIDTH / 2);
  const tipY = useSharedValue(-200);
  const tipOpacity = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withTiming(visible ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.ease),
    });
  }, [visible, overlayOpacity]);

  useEffect(() => {
    if (!visible || !layout || !step) {
      tipOpacity.value = withTiming(0, { duration: 160 });
      return;
    }

    const placement = step.placement ?? "bottom";
    const targetX = Math.max(
      16,
      Math.min(
        SCREEN_WIDTH - TIP_WIDTH - 16,
        layout.x + layout.width / 2 - TIP_WIDTH / 2,
      ),
    );
    const adjustedY = layout.y + insets.top;
    const baseY =
      placement === "bottom"
        ? adjustedY + layout.height + TIP_GAP
        : adjustedY - TIP_GAP - 150;
    const targetY = baseY + (step.tipOffsetY ?? 0);

    const config = { duration: 360, easing: Easing.out(Easing.cubic) };
    tipX.value = withTiming(targetX, config);
    tipY.value = withTiming(targetY, config);
    tipOpacity.value = withTiming(1, { duration: 280 });
  }, [visible, layout, step, tipX, tipY, tipOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const tipStyle = useAnimatedStyle(() => ({
    opacity: tipOpacity.value,
    transform: [{ translateX: tipX.value }, { translateY: tipY.value }],
  }));

  if (!visible) {
    return null;
  }

  const isLast = stepIndex === totalSteps - 1;

  return (
    <Portal hostName="overlay" name="tour-overlay">
      <Animated.View style={[styles.dim, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={stop} />
      </Animated.View>
      <Animated.View style={[styles.tip, tipStyle]} pointerEvents="box-none">
        <View style={styles.tipBadge}>
          <Text style={styles.tipBadgeText}>
            {stepIndex + 1} / {totalSteps}
          </Text>
        </View>
        <Text style={styles.tipTitle}>{step!.title}</Text>
        <Text style={styles.tipDescription}>{step!.description}</Text>
        <View style={styles.tipActions}>
          <Pressable hitSlop={10} onPress={stop}>
            <Text style={styles.tipSkip}>Skip</Text>
          </Pressable>
          <Pressable style={styles.tipNext} onPress={next}>
            <Text style={styles.tipNextText}>
              {isLast ? "Done" : "Next"}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 25, 0.55)",
  },
  tip: {
    position: "absolute",
    width: TIP_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tipBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  tipBadgeText: {
    color: "#6366f1",
    fontSize: 12,
    fontWeight: "700",
  },
  tipTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 6,
  },
  tipDescription: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "#5a5a72",
    marginBottom: 16,
  },
  tipActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tipSkip: {
    fontSize: 14,
    color: "#8a8aa0",
    fontWeight: "600",
  },
  tipNext: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tipNextText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
