import { StyleSheet, View } from "react-native";

import { COLORS } from "../theme";

const ContextMenuDivider = () => (
  <View
    style={{
      marginHorizontal: 12,
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.divider,
    }}
  />
);

export default ContextMenuDivider;
