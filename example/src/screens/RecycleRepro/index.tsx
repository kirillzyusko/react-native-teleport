import { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { Portal, PortalHost, usePortal } from "react-native-teleport";

const HOST_NAME = "repro-host";
const SWAP_HOST_A = "swap-host-a";
const SWAP_HOST_B = "swap-host-b";

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.label}>
      {label}: {value}
    </Text>
  );
}

function HostRemountScenario() {
  const [showHost, setShowHost] = useState(true);
  const [showPortal, setShowPortal] = useState(false);
  const [cycle, setCycle] = useState<0 | 1 | 2>(0);
  const { isHostAvailable } = usePortal(HOST_NAME);

  const stageText =
    cycle === 0
      ? "Ready"
      : cycle === 1
        ? "First teleport cycle"
        : "Second teleport cycle";

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>1. Host Remount</Text>
      <Text style={styles.description}>
        Unmounts and remounts a PortalHost with the same name, then teleports
        into it twice. Broken builds fail to show the second teleported card.
      </Text>

      <View style={styles.statusCard}>
        <StatusLine label="Stage" value={stageText} />
        <StatusLine label="Host mounted" value={showHost ? "yes" : "no"} />
        <StatusLine label="Portal visible" value={showPortal ? "yes" : "no"} />
        <StatusLine
          label="JS host availability"
          value={isHostAvailable ? "available" : "missing"}
        />
      </View>

      <View style={[styles.hostArea, !showHost && styles.hostAreaInactive]}>
        <Text style={styles.areaTitle}>Host Zone</Text>
        <Text style={styles.areaSubtitle}>
          The teal card should appear here on both cycles.
        </Text>
        <View style={styles.hostContent}>
          {showHost ? (
            <PortalHost name={HOST_NAME} style={StyleSheet.absoluteFill} />
          ) : (
            <Text style={styles.label}>Host is currently unmounted.</Text>
          )}
        </View>
      </View>

      <Button
        title="Teleport First Time"
        onPress={() => {
          setCycle(1);
          setShowPortal(true);
        }}
        testID="teleport_first_time"
      />
      <Button
        title="Unmount Host"
        onPress={() => {
          setShowPortal(false);
          setShowHost(false);
        }}
        testID="unmount_host"
      />
      <Button
        title="Remount Host"
        onPress={() => {
          setShowHost(true);
        }}
        testID="remount_host"
      />
      <Button
        title="Teleport Second Time"
        onPress={() => {
          setCycle(2);
          setShowPortal(true);
        }}
        testID="teleport_second_time"
      />
      <Button
        title="Reset"
        onPress={() => {
          setShowPortal(false);
          setShowHost(true);
          setCycle(0);
        }}
        testID="reset_repro"
      />

      {showPortal ? (
        <Portal hostName={HOST_NAME} name={`repro-portal-${cycle}`}>
          <View style={styles.teleportedCard} testID="remount_teleported_card">
            <Text style={styles.teleportedTitle}>TELEPORTED</Text>
            <Text style={styles.teleportedBody}>
              {cycle === 1
                ? "First cycle content should render in the host."
                : "Second cycle content should also render in the same host."}
            </Text>
          </View>
        </Portal>
      ) : null}
    </View>
  );
}

function PortalSwapScenario() {
  const [mode, setMode] = useState<"layers" | "overlay">("layers");

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>2. Portal Swap</Text>
      <Text style={styles.description}>
        Swaps between two Portals with different hostNames at the same tree
        position. Host B is nested inside Host A — Fabric recycles the
        PortalView, and stale host references used to cause a crash.
      </Text>

      <View style={styles.statusCard}>
        <StatusLine label="Current mode" value={mode} />
      </View>

      <View style={styles.swapHostOuter}>
        <Text style={styles.areaTitle}>Host A (outer)</Text>
        <PortalHost name={SWAP_HOST_A} style={styles.swapHostContent} />
        <View style={styles.swapHostInner}>
          <Text style={styles.areaTitle}>Host B (inner)</Text>
          <PortalHost name={SWAP_HOST_B} style={styles.swapHostContent} />
        </View>
      </View>

      {mode === "layers" ? (
        <Portal hostName={SWAP_HOST_A}>
          <View style={styles.teleportedCard} testID="swap_layers_content">
            <Text style={styles.teleportedTitle}>Layer content (Host A)</Text>
          </View>
        </Portal>
      ) : (
        <Portal hostName={SWAP_HOST_B}>
          <View style={styles.teleportedCard} testID="swap_overlay_content">
            <Text style={styles.teleportedTitle}>Overlay content (Host B)</Text>
          </View>
        </Portal>
      )}

      <Button
        title="Switch mode"
        onPress={() => setMode((m) => (m === "layers" ? "overlay" : "layers"))}
        testID="switch_mode"
      />
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function RecycleRepro() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="recycling_scroll_view"
    >
      <HostRemountScenario />
      <View style={styles.divider} />
      <PortalSwapScenario />
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  description: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 8,
  },
  statusCard: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  label: {
    fontSize: 13,
    color: "#334155",
  },
  areaTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  areaSubtitle: {
    fontSize: 12,
    color: "#475569",
  },
  hostArea: {
    minHeight: 120,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  hostAreaInactive: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  hostContent: {
    flex: 1,
    marginTop: 8,
    minHeight: 60,
  },
  swapHostOuter: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
    gap: 8,
  },
  swapHostInner: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
    gap: 8,
  },
  swapHostContent: {
    minHeight: 50,
  },
  teleportedCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#0f766e",
  },
  teleportedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ecfeff",
  },
  teleportedBody: {
    marginTop: 4,
    fontSize: 12,
    color: "#ccfbf1",
  },
});
