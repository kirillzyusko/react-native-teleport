import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import {
  FontAwesome6,
  type FontAwesome6SolidIconName,
} from "@react-native-vector-icons/fontawesome6";
import { TourProvider, useTour } from "./TourContext";
import TourTarget from "./TourTarget";
import TourOverlay from "./TourOverlay";
import { TRANSACTIONS } from "./transactions";

type QuickAction = {
  icon: FontAwesome6SolidIconName;
  label: string;
  color: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { icon: "arrow-up", label: "Send", color: "#6366f1" },
  { icon: "arrow-down", label: "Request", color: "#16a34a" },
  { icon: "plus", label: "Top Up", color: "#f59e0b" },
  { icon: "ellipsis", label: "More", color: "#64748b" },
];

type Tab = {
  icon: FontAwesome6SolidIconName;
  label: string;
};

const TABS: Tab[] = [
  { icon: "house", label: "Home" },
  { icon: "credit-card", label: "Cards" },
  { icon: "chart-line", label: "Stats" },
  { icon: "user", label: "Profile" },
];

function BalanceCard() {
  return (
    <LinearGradient
      colors={["#4f46e5", "#7c3aed", "#a855f7"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardLabel}>Total Balance</Text>
        <FontAwesome6
          name="wifi"
          iconStyle="solid"
          size={18}
          color="rgba(255,255,255,0.85)"
          style={styles.cardChip}
        />
      </View>
      <Text style={styles.cardBalance}>$12,450.75</Text>
      <View style={styles.cardBottomRow}>
        <Text style={styles.cardNumber}>•••• •••• •••• 4242</Text>
        <Text style={styles.cardBrand}>VISA</Text>
      </View>
    </LinearGradient>
  );
}

function AppTourContent() {
  const { start, stepIndex } = useTour();
  const tourActive = stepIndex >= 0;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const id = setTimeout(start, 1000);
    return () => clearTimeout(id);
  }, [start]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>K</Text>
          </View>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.name}>Kiryl</Text>
          </View>
        </View>
        <TourTarget id="bell">
          <Pressable style={styles.bell}>
            <FontAwesome6
              name="bell"
              iconStyle="solid"
              size={18}
              color="#1a1a2e"
            />
            <View style={styles.bellDot} />
          </Pressable>
        </TourTarget>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <TourTarget id="card">
          <BalanceCard />
        </TourTarget>

        <TourTarget id="actions">
          <View style={styles.actions}>
            {QUICK_ACTIONS.map((a) => (
              <View key={a.label} style={styles.action}>
                <View style={[styles.actionIcon, { backgroundColor: a.color }]}>
                  <FontAwesome6
                    name={a.icon}
                    iconStyle="solid"
                    size={16}
                    color="#fff"
                  />
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </View>
            ))}
          </View>
        </TourTarget>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Text style={styles.sectionLink}>See all</Text>
        </View>

        <TourTarget id="transactions">
          <View style={styles.transactions}>
            {TRANSACTIONS.map((t, i) => (
              <View key={t.id}>
                <View style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: t.bg }]}>
                    <FontAwesome6
                      name={t.icon}
                      iconStyle="solid"
                      size={16}
                      color={t.tint}
                    />
                  </View>
                  <View style={styles.txTextWrap}>
                    <Text style={styles.txTitle}>{t.title}</Text>
                    <Text style={styles.txSubtitle}>{t.subtitle}</Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      t.positive && styles.txAmountPositive,
                    ]}
                  >
                    {t.amount}
                  </Text>
                </View>
                {i < TRANSACTIONS.length - 1 && <View style={styles.txDivider} />}
              </View>
            ))}
          </View>
        </TourTarget>

        {!tourActive && (
          <Pressable style={styles.startTourBtn} onPress={start}>
            <FontAwesome6
              name="wand-magic-sparkles"
              iconStyle="solid"
              size={14}
              color="#fff"
            />
            <Text style={styles.startTourText}>Start app tour</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 4 }]}>
        {TABS.map((tab, i) => {
          const active = i === 0;
          return (
            <View key={tab.label} style={styles.tab}>
              <FontAwesome6
                name={tab.icon}
                iconStyle="solid"
                size={18}
                color={active ? "#6366f1" : "#9aa0b4"}
              />
              <Text
                style={[styles.tabLabel, active && styles.tabLabelActive]}
              >
                {tab.label}
              </Text>
            </View>
          );
        })}
      </View>

      <TourOverlay />
    </SafeAreaView>
  );
}

export default function AppTourExample() {
  return (
    <TourProvider>
      <AppTourContent />
    </TourProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f5f9",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  greeting: {
    color: "#8a8aa0",
    fontSize: 12,
  },
  name: {
    color: "#1a1a2e",
    fontSize: 16,
    fontWeight: "700",
  },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  bellDot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 18,
  },
  card: {
    borderRadius: 22,
    padding: 22,
    minHeight: 180,
    justifyContent: "space-between",
    shadowColor: "#6366f1",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
  },
  cardChip: {
    transform: [{ rotate: "90deg" }],
  },
  cardBalance: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 18,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  cardNumber: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    letterSpacing: 2,
  },
  cardBrand: {
    color: "#fff",
    fontSize: 16,
    fontStyle: "italic",
    fontWeight: "800",
    letterSpacing: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  action: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 12,
    color: "#1a1a2e",
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  sectionLink: {
    fontSize: 13,
    color: "#6366f1",
    fontWeight: "600",
  },
  transactions: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txTextWrap: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  txSubtitle: {
    fontSize: 12,
    color: "#8a8aa0",
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  txAmountPositive: {
    color: "#16a34a",
  },
  txDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ececf1",
    marginLeft: 66,
  },
  startTourBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1a1a2e",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  startTourText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ececf1",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    color: "#9aa0b4",
    fontWeight: "600",
  },
  tabLabelActive: {
    color: "#6366f1",
  },
});
