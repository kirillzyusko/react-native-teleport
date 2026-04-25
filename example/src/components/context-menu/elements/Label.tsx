import React from "react";
import { StyleSheet, Text, View } from "react-native";

import Divider from "./Divider";

export type LabelProps = {
  isLast?: boolean;
  children: React.ReactNode;
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});

const Label: React.FC<LabelProps> = ({ isLast = false, children }) => {
  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>{children}</Text>
      </View>

      {!isLast && <Divider />}
    </>
  );
};

export default Label;
