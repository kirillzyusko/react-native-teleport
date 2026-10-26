import { useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import styles from "./styles";
import { tracePress } from "../../../../diagnostics/touchTrace";

import type { Example } from "../../types";

type Props<T> = Omit<Example, "info"> & {
  info: T;
  onPress: (info: T) => void;
  index: number;
};

const ExampleLink = <T,>(props: Props<T>) => {
  const { onPress, title, testID, info, icons, index } = props;

  const onCardPress = useCallback(() => onPress(info), [info, onPress]);

  return (
    <TouchableOpacity
      style={styles.container}
      testID={testID}
      onPress={tracePress(`example.${testID}`, onCardPress)}
    >
      <View style={styles.row}>
        <Text style={styles.text}>
          {index}. {title}
        </Text>
        <Text style={styles.text}>{icons}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default ExampleLink;
