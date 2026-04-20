import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { Portal, PortalHost, usePortal } from "react-native-teleport";

const HOST_NAME = "repro-host";
const TICK_MS = 120;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  section: {
    gap: 8,
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
  stage: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  sourceArea: {
    minHeight: 180,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  hostArea: {
    minHeight: 180,
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
  areaTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  areaSubtitle: {
    fontSize: 12,
    color: "#475569",
  },
  hostContent: {
    flex: 1,
    marginTop: 12,
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

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.label}>
      {label}: {value}
    </Text>
  );
}

export default function RecycleRepro() {
  const [showHost, setShowHost] = useState(true);
  const [showPortal, setShowPortal] = useState(false);
  const [cycle, setCycle] = useState<0 | 1 | 2>(0);
  const [isRunning, setIsRunning] = useState(false);
  const { isHostAvailable } = usePortal(HOST_NAME);

  const stageText =
    cycle === 0
      ? "Ready"
      : cycle === 1
        ? "First teleport cycle"
        : "Second teleport cycle";

  const hostStyle = [styles.hostArea, !showHost && styles.hostAreaInactive];

  const reset = () => {
    setShowPortal(false);
    setShowHost(true);
    setCycle(0);
  };

  const teleportFirstTime = () => {
    setCycle(1);
    setShowPortal(true);
  };

  const unmountHost = () => {
    setShowPortal(false);
    setShowHost(false);
  };

  const remountHost = () => {
    setShowHost(true);
  };

  const teleportSecondTime = () => {
    setCycle(2);
    setShowPortal(true);
  };

  const runRepro = async () => {
    setIsRunning(true);

    try {
      setShowPortal(false);
      setShowHost(true);
      setCycle(0);
      await wait(TICK_MS);

      setCycle(1);
      setShowPortal(true);
      await wait(TICK_MS);

      setShowPortal(false);
      setShowHost(false);
      await wait(TICK_MS);

      setShowHost(true);
      await wait(TICK_MS);

      setCycle(2);
      setShowPortal(true);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.section}>
        <Text style={styles.stage}>iOS Fabric Recycle Repro</Text>
        <Text style={styles.label}>
          This screen remounts {`PortalHost("${HOST_NAME}")`} and teleports into
          it twice to exercise same-name native view reuse.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <StatusLine label="Stage" value={stageText} />
        <StatusLine label="Host mounted" value={showHost ? "yes" : "no"} />
        <StatusLine label="Portal visible" value={showPortal ? "yes" : "no"} />
        <StatusLine
          label="JS host availability"
          value={isHostAvailable ? "available" : "missing"}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.column}>
          <View style={styles.sourceArea}>
            <Text style={styles.areaTitle}>Controls</Text>
            <Text style={styles.areaSubtitle}>
              Broken iOS builds usually fail to show the second teleported card.
            </Text>
          </View>
          <Button
            title="Teleport First Time"
            onPress={teleportFirstTime}
            testID="teleport_first_time"
          />
          <Button
            title="Unmount Host"
            onPress={unmountHost}
            testID="unmount_host"
          />
          <Button
            title="Remount Host"
            onPress={remountHost}
            testID="remount_host"
          />
          <Button
            title="Teleport Second Time"
            onPress={teleportSecondTime}
            testID="teleport_second_time"
          />
          <Button
            title={isRunning ? "Running Repro..." : "Run Repro"}
            disabled={isRunning}
            onPress={runRepro}
            testID="run_repro"
          />
          <Button title="Reset" onPress={reset} testID="reset_repro" />
        </View>

        <View style={styles.column}>
          <View style={hostStyle}>
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
        </View>
      </View>

      {showPortal ? (
        <Portal hostName={HOST_NAME} name={`repro-portal-${cycle}`}>
          <View style={styles.teleportedCard} testID="teleported-card">
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
