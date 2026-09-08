import { StyleSheet, View } from "react-native";

import Controls from "./Controls";
import HostProvider from "./HostProvider";
import { StableHostRemountStack } from "./navigation";
import Screen from "./Screen";

export default function Landing() {
  return (
    <HostProvider>
      <View style={styles.container}>
        <StableHostRemountStack.Navigator screenOptions={{ headerShown: true }}>
          <StableHostRemountStack.Screen
            component={Controls}
            name="Landing"
            options={{ title: "Stable host remount" }}
          />
          <StableHostRemountStack.Screen
            component={Screen}
            name="Screen"
            options={{ title: "Screen" }}
          />
        </StableHostRemountStack.Navigator>
      </View>
    </HostProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
