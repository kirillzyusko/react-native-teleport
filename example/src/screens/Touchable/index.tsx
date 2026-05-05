import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Portal, PortalHost } from "react-native-teleport";
import {
  FontAwesome6,
  type FontAwesome6SolidIconName,
} from "@react-native-vector-icons/fontawesome6";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ScalePressable({ style, children, ...rest }: PressableProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[animStyle, style as never]}
      onPressIn={() => {
        scale.value = withTiming(0.95, { duration: 150 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, {
          duration: 250,
          easing: Easing.out(Easing.ease),
        });
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

const MENU_ITEMS: Array<{ icon: FontAwesome6SolidIconName; label: string }> = [
  { icon: "user", label: "Profile" },
  { icon: "gear", label: "Settings" },
  { icon: "bell", label: "Notifications" },
  { icon: "shield-halved", label: "Privacy & Security" },
  { icon: "circle-question", label: "Help & Support" },
];

function LogoutAlert({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const overlayOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.85);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.ease),
    });
    cardScale.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.back(1.4)),
    });
    cardOpacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.ease),
    });
  }, [overlayOpacity, cardScale, cardOpacity]);

  const dismiss = (cb: () => void) => {
    overlayOpacity.value = withTiming(0, { duration: 180 });
    cardScale.value = withTiming(0.85, { duration: 180 });
    cardOpacity.value = withTiming(0, { duration: 180 });
    setTimeout(cb, 190);
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, overlayStyle]} />
      <View style={styles.alertContainer}>
        <Animated.View style={[styles.alertCard, cardStyle]}>
          <View style={styles.alertIconWrap}>
            <FontAwesome6
              name="right-from-bracket"
              iconStyle="solid"
              size={28}
              color="#E53E3E"
            />
          </View>
          <Text style={styles.alertTitle}>Log Out</Text>
          <Text style={styles.alertMessage}>
            Are you sure you want to log out?
          </Text>
          <View style={styles.alertActions}>
            <ScalePressable
              style={[styles.alertBtn, styles.alertBtnCancel]}
              onPress={() => dismiss(onCancel)}
            >
              <Text style={styles.alertBtnCancelText}>No, Stay</Text>
            </ScalePressable>
            <ScalePressable
              style={[styles.alertBtn, styles.alertBtnConfirm]}
              onPress={() => dismiss(onConfirm)}
            >
              <Text style={styles.alertBtnConfirmText}>Yes, Log Out</Text>
            </ScalePressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

export default function ProfileMenuExample() {
  const [alertVisible, setAlertVisible] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            <FontAwesome6
              name="user"
              iconStyle="solid"
              size={26}
              color="#fff"
            />
          </View>
          <View>
            <Text style={styles.headerName}>Kiryl Ziusko</Text>
            <Text style={styles.headerEmail}>kiryl@example.com</Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, i) => (
            <View key={item.label}>
              <ScalePressable
                style={styles.menuRow}
                android_ripple={{ color: "#f0f0f0" }}
              >
                <View style={styles.menuIconWrap}>
                  <FontAwesome6
                    name={item.icon}
                    iconStyle="solid"
                    size={16}
                    color="#6366f1"
                  />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <FontAwesome6
                  name="chevron-right"
                  iconStyle="solid"
                  size={12}
                  color="#c0c0c0"
                />
              </ScalePressable>
              {i < MENU_ITEMS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <ScalePressable
          style={styles.logoutBtn}
          onPress={() => setAlertVisible(true)}
        >
          <FontAwesome6
            name="right-from-bracket"
            iconStyle="solid"
            size={16}
            color="#E53E3E"
          />
          <Text style={styles.logoutText}>Log Out</Text>
        </ScalePressable>
        {alertVisible && (
          <View style={{height: 200}}>
            <LogoutAlert
              onConfirm={() => setAlertVisible(false)}
              onCancel={() => setAlertVisible(false)}
            />
          </View>
        )}
      </View>

      <PortalHost name="alert-overlay" style={StyleSheet.absoluteFillObject} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f5f7",
    paddingHorizontal: 20,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  headerEmail: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a2e",
    fontWeight: "500",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#f0f0f0",
    marginLeft: 60,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E53E3E",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  alertContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  alertCard: {
    width: 300,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  alertIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  alertActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  alertBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  alertBtnCancel: {
    backgroundColor: "#f0f0f5",
  },
  alertBtnConfirm: {
    backgroundColor: "#E53E3E",
  },
  alertBtnCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  alertBtnConfirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
