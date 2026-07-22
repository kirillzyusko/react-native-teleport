import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Portal, PortalHost } from "react-native-teleport";

type Size = { w: number; h: number };

// A message bubble to anchor the menu around, mimicking a long pressed message.
const MESSAGE = { h: 96, w: 300, x: 40, y: 340 };
// Fixed host sizes used by scale only mode (roughly the natural content sizes).
const TOP_FIXED: Size = { h: 52, w: 220 };
const BOTTOM_FIXED: Size = { h: 176, w: 220 };
// Below this width the teleported top item has clearly collapsed. Used only for
// the on screen OK/COLLAPSED status.
const TOP_OK_MIN_WIDTH = 160;

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢"];
const ACTIONS = ["Reply", "Copy", "Edit", "Delete"];

const format = (r: Size | null) =>
  r ? `${Math.round(r.w)} x ${Math.round(r.h)}` : "-";

export default function ScaledHost() {
  const [active, setActive] = useState(false);
  const [feedback, setFeedback] = useState(true);
  // Kept in React state only for the on screen readout of the bug, not really needed
  // otherwise.
  const [topSize, setTopSize] = useState<Size | null>(null);
  const [bottomSize, setBottomSize] = useState<Size | null>(null);

  const topWH = useSharedValue<Size>(TOP_FIXED);
  const bottomWH = useSharedValue<Size>(BOTTOM_FIXED);
  const backdrop = useSharedValue(0);

  const open = () => {
    setActive(true);
    backdrop.value = withSpring(1, { duration: 400 });
  };

  const close = () => {
    setActive(false);
    backdrop.value = withSpring(0, { duration: 300 });
    topWH.value = TOP_FIXED;
    bottomWH.value = BOTTOM_FIXED;
    setTopSize(null);
    setBottomSize(null);
  };

  const topItemStyle = useAnimatedStyle(() => {
    const size = feedback ? topWH.value : TOP_FIXED;
    return {
      height: size.h,
      left: MESSAGE.x,
      position: "absolute",
      top: MESSAGE.y - size.h,
      transform: [{ scale: backdrop.value }],
      width: size.w,
    };
  });

  const bottomItemStyle = useAnimatedStyle(() => {
    const size = feedback ? bottomWH.value : BOTTOM_FIXED;
    return {
      height: size.h,
      left: MESSAGE.x,
      position: "absolute",
      top: MESSAGE.y + MESSAGE.h,
      transform: [{ scale: backdrop.value }],
      width: size.w,
    };
  });

  const topOk = topSize ? topSize.w >= TOP_OK_MIN_WIDTH : null;

  return (
    <View style={styles.screen}>
      <Pressable
        disabled={active}
        onPress={() => setFeedback((f) => !f)}
        style={[styles.mode, active && styles.modeDisabled]}
        testID="sizing_mode"
      >
        <Text style={styles.modeText}>
          sizing: {feedback ? "feedback" : "scale-only"}
          {active ? "" : " (tap to switch)"}
        </Text>
      </Pressable>

      <Text style={styles.readout} testID="top_measured">
        top: {format(topSize)}
      </Text>
      <Text style={styles.readout} testID="bottom_measured">
        bottom: {format(bottomSize)}
      </Text>
      <Text style={styles.status} testID="top_status">
        status:{" "}
        {active ? (topOk === null ? "…" : topOk ? "OK" : "COLLAPSED") : "idle"}
      </Text>
      <Pressable
        onPress={active ? close : open}
        style={styles.button}
        testID="context_menu_toggle"
      >
        <Text style={styles.buttonText}>
          {active ? "Close" : "Open context menu"}
        </Text>
      </Pressable>

      <Portal hostName={active ? "top-item" : undefined}>
        {active ? (
          <View
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              topWH.value = { h, w };
              setTopSize({ h, w });
            }}
            style={styles.reactionBar}
          >
            {REACTIONS.map((r) => (
              <Text key={r} style={styles.reaction}>
                {r}
              </Text>
            ))}
          </View>
        ) : null}
      </Portal>

      <Portal hostName={active ? "bottom-item" : undefined}>
        {active ? (
          <View
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              bottomWH.value = { h, w };
              setBottomSize({ h, w });
            }}
            style={styles.actionList}
          >
            {ACTIONS.map((a) => (
              <Text key={a} style={styles.action}>
                {a}
              </Text>
            ))}
          </View>
        ) : null}
      </Portal>

      <View style={styles.message}>
        <Text style={styles.messageText}>Long-pressed message</Text>
      </View>

      <Animated.View pointerEvents="box-none" style={topItemStyle}>
        <PortalHost name="top-item" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={bottomItemStyle}>
        <PortalHost name="bottom-item" style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    color: "#0f172a",
    fontSize: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  actionList: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  message: {
    backgroundColor: "#4f83ff",
    borderRadius: 16,
    height: MESSAGE.h,
    justifyContent: "center",
    left: MESSAGE.x,
    paddingHorizontal: 16,
    position: "absolute",
    top: MESSAGE.y,
    width: MESSAGE.w,
  },
  messageText: {
    color: "#fff",
    fontWeight: "600",
  },
  mode: {
    alignSelf: "flex-start",
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modeDisabled: {
    opacity: 0.5,
  },
  modeText: {
    color: "#0f172a",
    fontWeight: "600",
  },
  reaction: {
    fontSize: 26,
  },
  reactionBar: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  readout: {
    color: "#0f172a",
  },
  screen: {
    flex: 1,
    gap: 6,
    padding: 16,
  },
  status: {
    fontWeight: "700",
  },
});
