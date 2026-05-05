import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FEATURES = [
  {
    icon: "shield-halved" as const,
    title: "Private & Secure",
    subtitle: "End-to-end encryption on all messages",
  },
  {
    icon: "bolt" as const,
    title: "Lightning Fast",
    subtitle: "Real-time sync across all your devices",
  },
  {
    icon: "users" as const,
    title: "Collaborate",
    subtitle: "Share and work together seamlessly",
  },
];

function AgeSheet({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useSharedValue(0);
  const sheetY = useSharedValue(400);

  useEffect(() => {
    backdropOpacity.value = withTiming(1, {
      duration: 250,
      easing: Easing.out(Easing.ease),
    });
    sheetY.value = withTiming(0, {
      duration: 320,
      easing: Easing.out(Easing.ease),
    });
  }, [backdropOpacity, sheetY]);

  const dismiss = () => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    sheetY.value = withTiming(400, {
      duration: 260,
      easing: Easing.in(Easing.ease),
    });
    setTimeout(onClose, 270);
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.modalBackdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 24 },
          sheetStyle,
        ]}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.sheetIconWrap}>
          <FontAwesome6
            name="id-card"
            iconStyle="solid"
            size={28}
            color="#6366f1"
          />
        </View>
        <Text style={styles.sheetTitle}>Age Verification</Text>
        <Text style={styles.sheetMessage}>
          Launchpad is intended for users aged 18 and older. Please confirm
          your age to continue.
        </Text>
        <View style={styles.sheetActions}>
          <Pressable
            style={[styles.sheetBtn, styles.sheetBtnSecondary]}
            onPress={dismiss}
          >
            <Text style={styles.sheetBtnSecondaryText}>I&apos;m under 18</Text>
          </Pressable>
          <Pressable
            style={[styles.sheetBtn, styles.sheetBtnPrimary]}
            onPress={dismiss}
          >
            <Text style={styles.sheetBtnPrimaryText}>Yes, I&apos;m 18+</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

export default function RNModalExample() {
  const [ageModalVisible, setAgeModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + 32 }]}>
        <View style={styles.hero}>
          <View style={styles.appIcon}>
            <FontAwesome6
              name="rocket"
              iconStyle="solid"
              size={36}
              color="#fff"
            />
          </View>
          <Text style={styles.appName}>Launchpad</Text>
          <Text style={styles.tagline}>
            Your all-in-one productivity workspace
          </Text>
        </View>

        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <FontAwesome6
                  name={f.icon}
                  iconStyle="solid"
                  size={16}
                  color="#6366f1"
                />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSubtitle}>{f.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.terms}>
          By continuing you agree to our{" "}
          <Text style={styles.termsLink}>Terms of Service</Text>
        </Text>
        <Pressable
          style={styles.continueBtn}
          onPress={() => setAgeModalVisible(true)}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
          <FontAwesome6
            name="arrow-right"
            iconStyle="solid"
            size={14}
            color="#fff"
          />
        </Pressable>
      </View>

      <Modal
        visible={ageModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setAgeModalVisible(false)}
      >
        <AgeSheet onClose={() => setAgeModalVisible(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "space-between",
  },
  content: {
    paddingHorizontal: 28,
    gap: 48,
  },
  hero: {
    alignItems: "center",
    gap: 12,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1a1a2e",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: "#888",
    textAlign: "center",
    lineHeight: 22,
  },
  featureList: {
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  featureSubtitle: {
    fontSize: 13,
    color: "#888",
  },
  footer: {
    paddingHorizontal: 28,
    gap: 12,
  },
  terms: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
  },
  termsLink: {
    color: "#6366f1",
    fontWeight: "600",
  },
  continueBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#6366f1",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e0e0e0",
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  sheetMessage: {
    fontSize: 14,
    color: "#666",
    lineHeight: 21,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  sheetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  sheetBtnSecondary: {
    backgroundColor: "#f0f0f5",
  },
  sheetBtnPrimary: {
    backgroundColor: "#6366f1",
  },
  sheetBtnSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  sheetBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
