import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Portal, PortalHost } from "react-native-teleport";

const LOCAL_HOST = "transition-reparent-local";

type ReproStackParamList = {
  Instructions: undefined;
  DepartingScreen: undefined;
};

const Stack = createNativeStackNavigator<ReproStackParamList>();

function Instructions({
  navigation,
  onOpen,
}: NativeStackScreenProps<ReproStackParamList, "Instructions"> & {
  onOpen: () => void;
}) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Attached-host reparenting</Text>
      <Text style={styles.description}>
        A persistent Portal targets a host in the next screen. The trigger
        starts a native-stack pop and switches the Portal to the app-level
        overlay host in the same update, while both hosts are attached.
      </Text>
      <Button
        onPress={() => {
          onOpen();
          navigation.navigate("DepartingScreen");
        }}
        testID="open-transition-reparent"
        title="Open departing screen"
      />
    </View>
  );
}

function DepartingScreen({
  navigation,
  onClosing,
}: NativeStackScreenProps<ReproStackParamList, "DepartingScreen"> & {
  onClosing: () => void;
}) {
  return (
    <View style={styles.screen} testID="transition-reparent-screen">
      <Text style={styles.title}>Departing native-stack screen</Text>
      <Text style={styles.description}>
        The persistent Portal currently targets this screen.
      </Text>

      <View style={styles.hostFrame}>
        <Text style={styles.hostLabel}>Screen-local PortalHost</Text>
        <PortalHost name={LOCAL_HOST} style={StyleSheet.absoluteFill} />
      </View>

      <Button
        onPress={() => {
          navigation.goBack();
          onClosing();
        }}
        testID="trigger-transition-reparent"
        title="Pop and switch host"
      />
    </View>
  );
}

export default function TransitionReparent() {
  const [hostName, setHostName] = useState(LOCAL_HOST);
  const [portalVisible, setPortalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Stack.Navigator>
        <Stack.Screen
          name="Instructions"
          options={{ title: "Reparent during transition" }}
        >
          {(props) => (
            <Instructions
              {...props}
              onOpen={() => {
                setHostName(LOCAL_HOST);
                setPortalVisible(true);
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="DepartingScreen"
          options={{ title: "Attached local host" }}
        >
          {(props) => (
            <DepartingScreen
              {...props}
              onClosing={() => setHostName("overlay")}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>

      {portalVisible && (
        <Portal hostName={hostName}>
          <View style={styles.card} testID="transition-reparent-card">
            <Text style={styles.cardTitle}>Portal card</Text>
            <Text style={styles.cardText}>
              This persistent view moves when the pop starts.
            </Text>
          </View>
        </Portal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    gap: 20,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  description: {
    color: "#4b5563",
    fontSize: 16,
    lineHeight: 24,
  },
  hostFrame: {
    backgroundColor: "#dbeafe",
    borderColor: "#2563eb",
    borderRadius: 16,
    borderWidth: 2,
    flex: 1,
    overflow: "hidden",
  },
  hostLabel: {
    color: "#1e40af",
    fontSize: 14,
    fontWeight: "700",
    padding: 12,
  },
  card: {
    alignSelf: "center",
    backgroundColor: "#f97316",
    borderRadius: 14,
    elevation: 8,
    marginTop: 80,
    padding: 24,
    width: "80%",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  cardText: {
    color: "#fff7ed",
    fontSize: 15,
    marginTop: 8,
  },
});
