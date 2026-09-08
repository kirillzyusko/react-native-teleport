import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useExpand } from "./HostProvider";
import type { StableHostRemountParamList } from "./navigation";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

type Props = NativeStackScreenProps<StableHostRemountParamList, "Landing">;

export default function Controls({ navigation }: Props) {
  const expand = useExpand();
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const runRepro = async () => {
    setRunning(true);
    setCompleted(false);

    for (let i = 0; i < 15; i++) {
      navigation.push("Screen");
      await wait(400);
      expand();
      navigation.goBack();
      await wait(400);
    }

    setRunning(false);
    setCompleted(true);
  };

  return (
    <View style={styles.screen} testID="repro_controls">
      <Button
        disabled={running}
        onPress={runRepro}
        testID="repro_run"
        title={running ? "Running repro" : "Run repro"}
      />
      {completed && (
        <Text style={styles.completed} testID="repro_complete">
          Completed without crash
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
  },
  completed: {
    marginTop: 16,
  },
});
