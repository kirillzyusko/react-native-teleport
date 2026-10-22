import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import type { NavigatorScreenParams } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { Portal, PortalHost } from "react-native-teleport";

const HOST = "nested-stack-pop";

type InnerParamList = { Home: undefined; Host: undefined };
type OuterParamList = {
  Instructions: undefined;
  Group: NavigatorScreenParams<InnerParamList>;
};

const Outer = createNativeStackNavigator<OuterParamList>();
const Inner = createNativeStackNavigator<InnerParamList>();

function Instructions({
  navigation,
}: NativeStackScreenProps<OuterParamList, "Instructions">) {
  return (
    <View style={styles.screen}>
      <Text>
        Open a host in a nested native stack, then pop the entire group. The
        persistent Portal returns to its own location when the host screen
        unmounts.
      </Text>
      <Button
        testID="nested-stack-pop-open"
        title="Open nested host"
        onPress={() =>
          navigation.navigate("Group", { screen: "Host", initial: false })
        }
      />
    </View>
  );
}

function Home() {
  return <Text>Inner stack root</Text>;
}

function HostScreen({
  navigation,
  setHostName,
}: NativeStackScreenProps<InnerParamList, "Host"> & {
  setHostName: (name: string | undefined) => void;
}) {
  useEffect(() => {
    setHostName(HOST);
    return () => setHostName(undefined);
  }, [setHostName]);

  return (
    <View style={styles.screen}>
      <PortalHost name={HOST} style={styles.host} />
      <Button
        testID="nested-stack-pop-close"
        title="Pop outer group"
        onPress={() => navigation.getParent()?.goBack()}
      />
    </View>
  );
}

export default function NestedStackPop() {
  const [hostName, setHostName] = useState<string | undefined>(undefined);

  return (
    <View style={styles.container}>
      <Outer.Navigator>
        <Outer.Screen
          component={Instructions}
          name="Instructions"
          options={{ title: "Nested stack pop (#198)" }}
        />
        <Outer.Screen name="Group" options={{ headerShown: false }}>
          {() => (
            <Inner.Navigator>
              <Inner.Screen component={Home} name="Home" />
              <Inner.Screen name="Host">
                {(props) => <HostScreen {...props} setHostName={setHostName} />}
              </Inner.Screen>
            </Inner.Navigator>
          )}
        </Outer.Screen>
      </Outer.Navigator>

      <Portal hostName={hostName}>
        <View style={styles.card}>
          <Text>Persistent portal child</Text>
        </View>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screen: { flex: 1, gap: 24, padding: 24 },
  host: { flex: 1, backgroundColor: "#dbeafe" },
  card: { padding: 24, backgroundColor: "#fb923c" },
});
