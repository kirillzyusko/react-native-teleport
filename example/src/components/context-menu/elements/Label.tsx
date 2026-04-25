import React from "react";
import { Text, View } from "react-native";

import { Divider } from "../../../../modules/library";
import { commonStyle } from "../../../../styles/common";
import { createStyle } from "../../../../styles/utils";

////////////////////////////////////////////////////////////////////////////////

export type LabelProps = {
  isLast?: boolean;
  children: React.ReactNode;
};

const styles = createStyle({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    ...commonStyle.subheadText,
  },
});

const Label: React.FC<LabelProps> = ({ isLast = false, children }) => {
  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>{children}</Text>
      </View>

      {!isLast && <Divider type="none" />}
    </>
  );
};

export default Label;
