import { useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import styles from "./styles";

import type { Example, ExampleScreen } from "../../types";
import type { FC } from "react";

type Props = {
  onPress: (info: ExampleScreen) => void;
  index: number;
} & Example;

const ExampleLink: FC<Props> = (props) => {
  const { onPress, title, testID, info, icons, index } = props;

  const onCardPress = useCallback(() => onPress(info), [info, onPress]);

  return (
    <TouchableOpacity
      style={styles.container}
      testID={testID}
      onPress={onCardPress}
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
