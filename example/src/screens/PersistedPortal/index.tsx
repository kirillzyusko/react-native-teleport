import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { Portal, PortalHost } from "react-native-teleport";

import { PERSISTED_PORTAL_HOST } from "./hostName";

export default function PersistedPortal() {
  const [hostMounted, setHostMounted] = useState(false);
  const [toggleCount, setToggleCount] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        A {"<Portal>"} with hostName="{PERSISTED_PORTAL_HOST}" mounts on screen
        entry while no host is registered yet, so its child is physically
        attached inside PortalView. Tapping "Mount host" later mounts a
        {"<PortalHost>"} in a separate commit, which on Android Fabric release
        builds (1.1.4) NPEs in extractPhysicalChildren.
      </Text>

      <Portal hostName={PERSISTED_PORTAL_HOST}>
        <View testID="persisted_portal_teleported" style={styles.teleported}>
          <Text style={styles.teleportedText}>TELEPORTED CONTENT</Text>
        </View>
      </Portal>

      <Button
        testID="persisted_portal_toggle_host"
        title={
          hostMounted
            ? `Unmount host (toggles: ${toggleCount})`
            : `Mount host (toggles: ${toggleCount})`
        }
        onPress={() => {
          setHostMounted((v) => !v);
          setToggleCount((c) => c + 1);
        }}
      />

      <View style={styles.hostFrame}>
        <Text style={styles.hostFrameLabel}>
          {hostMounted
            ? "PortalHost area (host mounted)"
            : "PortalHost area (host NOT mounted)"}
        </Text>
        {hostMounted && (
          <PortalHost name={PERSISTED_PORTAL_HOST} style={styles.host} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
  },
  teleported: {
    width: 240,
    height: 60,
    backgroundColor: "crimson",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    alignSelf: "center",
  },
  teleportedText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  hostFrame: {
    flex: 1,
    borderColor: "#888",
    borderStyle: "dashed",
    borderWidth: 2,
    borderRadius: 8,
    padding: 8,
    minHeight: 200,
  },
  hostFrameLabel: {
    fontSize: 11,
    color: "#666",
    marginBottom: 6,
  },
  host: {
    flex: 1,
  },
});
