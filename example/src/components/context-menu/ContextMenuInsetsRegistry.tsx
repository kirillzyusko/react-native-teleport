import React, { useCallback } from "react";
import { View } from "react-native";

import useInsets from "./hooks/useInsets";

import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import type { InsetsMode } from "./types";

type Props = {
  mode: InsetsMode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Component that helps to register additional static insets (navigation header, tab bars, etc.)
 * It's needed for `ContextMenu` to be aware of those element in order to avoid overlapping of
 * `ContextMenu.Anchor` and other elements, if anchor is `teleportable`.
 */
const ContextMenuInsetsRegistry: React.FC<React.PropsWithChildren<Props>> = (
  props,
) => {
  const { mode, style, children } = props;
  const { setInsets } = useInsets();

  const onUpdateInsets = useCallback((e: LayoutChangeEvent) => {
    setInsets({ [mode]: e.nativeEvent.layout.height });
  }, []);

  return (
    <View style={style} onLayout={onUpdateInsets}>
      {children}
    </View>
  );
};

export default ContextMenuInsetsRegistry;
