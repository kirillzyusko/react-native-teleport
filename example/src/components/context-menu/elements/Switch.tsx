import React from "react";
import { Switch, Text, View } from "react-native";

import { Divider } from "../../../../modules/library";
import { COLOR_AC_YELLOW } from "../../../../styles/common";
import { createStyle } from "../../../../styles/utils";

import commonStyles from "./styles";

type ItemProps = {
  title: string;
  value: boolean;
  onChange: (isChecked: boolean) => void;
  isLast?: boolean;
};

const styles = createStyle({
  text: {
    alignSelf: "center",
    marginRight: 25,
  },
  container: {
    paddingVertical: 8.5,
  },
});

const TRACK_COLOR = { true: COLOR_AC_YELLOW };

const MenuSwitch: React.FC<ItemProps> = ({
  title,
  isLast,
  onChange,
  value,
}) => {
  return (
    <>
      <View style={[commonStyles.container, styles.container]}>
        <Text style={[commonStyles.text, styles.text]}>{title}</Text>
        <Switch
          trackColor={TRACK_COLOR}
          value={value}
          onValueChange={onChange}
        />
      </View>
      {!isLast && <Divider type="none" />}
    </>
  );
};

export default React.memo(MenuSwitch);
