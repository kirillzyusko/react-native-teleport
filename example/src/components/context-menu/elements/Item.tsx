import React, { useCallback, useMemo } from "react";
import { Text, View } from "react-native";
import Reanimated, {
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  useWorkletCallback,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import {
  COLOR_AC_RED,
  COLOR_BG_PRIMARY,
  COLOR_BG_ZERO,
} from "../../../../styles/common";
import { createStyle } from "../../../../styles/utils";
import haptic from "../../../../utils/haptic";
import SVGImage from "../../../SVGImage";
import { Divider } from "../../../../modules/library";
import { usePanHandler } from "../pan/PanContext";
import { useTeleport } from "../teleport/context";

import commonStyles from "./styles";

import type { Event } from "../pan/PanContext";
import type { Layout } from "../types";
import type { LayoutChangeEvent, TextStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";

enum ItemVariants {
  DEFAULT = "default",
  DANGER = "danger",
}

type ItemType = `${ItemVariants}`;

export type ItemBaseProps = {
  type?: ItemType;
  title: string;
  isLast?: boolean;
  disabled?: boolean;
  icon?: number;
  iconComponent?: React.ElementType<Record<string, never>>;
};

type ItemPropsNoItem = {
  item?: undefined;
  onPress: () => void;
};

type ItemPropsWithItem<T> = {
  item: T;
  onPress: (item: T) => void;
};

export type ItemProps<T> = (ItemPropsNoItem | ItemPropsWithItem<T>) &
  ItemBaseProps;

const typeStyles: Record<ItemType, TextStyle> = {
  [ItemVariants.DEFAULT]: {},
  [ItemVariants.DANGER]: {
    color: COLOR_AC_RED,
  },
};

const iconFill = {
  [ItemVariants.DEFAULT]: undefined,
  [ItemVariants.DANGER]: COLOR_AC_RED,
};

const styles = createStyle({
  icon: {
    marginLeft: 32,
    marginTop: 1,
    // SVGImage can be mounted in async way (if image is not cached yet, it will have 0x0 size
    // and later will take up necessary space). But ContextMenu measures the popup only one time
    // straight before animation (it's needed, because if during an animation size will be changed
    // it can cause junky transitions). So we specify container of image as 20x20 to assure that
    // the item will never change its size and initial calculation will be always correct.
    // If it's still not clear why it's needed - please have a look on:
    // https://bitbucket.org/goodyapp/mobile/pull-requests/2496/refactor-always-specify-container-size-for
    height: 20,
    width: 20,
  },
  disabled: {
    opacity: 0.48,
  },
});

const isItemHovered = (event: Event, layout: SharedValue<Layout>): boolean => {
  "worklet";

  const { x, y } = event;
  const { y: lY, x: lX, height, width } = layout.value;

  return y >= lY && y <= lY + height && x >= lX && x <= lX + width;
};

const isHovered = (
  event: Event,
  layout: SharedValue<Layout>,
  disabled: boolean,
): boolean => {
  "worklet";

  return isItemHovered(event, layout) && !disabled;
};

const FRAME_RENDER_TIME = 8;

function Item<T>(props: ItemProps<T>) {
  const {
    title,
    item,
    disabled = false,
    type = ItemVariants.DEFAULT,
    isLast,
    icon,
    iconComponent: IconComponent,
    onPress,
  } = props;
  const { destination } = useTeleport();
  const layout = useSharedValue({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const timestamp = useSharedValue(0);
  const hovered = useSharedValue(0); // 0 - not hovered, 1 - hovered
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    layout.value = {
      ...e.nativeEvent.layout,
      // for some reasons when context menu is moved by `y` axis - `onLayout` is not called with new
      // coordinates (most likely it shouldn't, since it reports relative coordinates).
      // But since it has "old" coordinates, taps will not be displayed adequately (you will tap
      // one item, but the other will be highlighted). To overcome the issue we are getting a value
      // for vertical movement and adding it here to relative `y` position.
      y: e.nativeEvent.layout.y + destination.value.top,
    };
  }, []);

  const highlight = useWorkletCallback((event: Event) => {
    if (isHovered(event, layout, disabled)) {
      hovered.value = 1;
    } else {
      hovered.value = 0;
    }
  }, []);
  const handler = useMemo(
    () => ({
      onStart: (event: Event) => {
        "worklet";

        timestamp.value = new Date().getTime();
        highlight(event);
      },
      onActive: highlight,
      onFinish: (event: Event) => {
        "worklet";

        if (isHovered(event, layout, disabled)) {
          hovered.value = withDelay(100, withTiming(0, { duration: 0 }));
          runOnJS(onPress as ItemPropsWithItem<T>["onPress"])(item as T);
        }
      },
    }),
    [onPress, item, disabled],
  );
  usePanHandler(handler, title);

  useAnimatedReaction(
    () => hovered.value,
    (current, previous) => {
      // run haptic if item was just hovered
      // time check is needed to avoid haptic feedback on first touch
      if (
        current === 1 &&
        previous === 0 &&
        new Date().getTime() - timestamp.value >= FRAME_RENDER_TIME
      ) {
        runOnJS(haptic)();
      }
    },
    [],
  );

  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      hovered.value,
      [0, 1],
      [COLOR_BG_PRIMARY, COLOR_BG_ZERO],
    ),
  }));

  const textStyle = [
    commonStyles.text,
    typeStyles[type],
    disabled && styles.disabled,
  ];
  const iconStyle = [styles.icon, disabled && styles.disabled];

  return (
    <>
      <Reanimated.View style={animated} onLayout={onLayout}>
        <View style={commonStyles.container}>
          <Text style={textStyle}>{title}</Text>

          <View style={iconStyle}>
            {icon && <SVGImage source={icon} fill={iconFill[type]} />}
            {IconComponent && <IconComponent />}
          </View>
        </View>
      </Reanimated.View>

      {!isLast && <Divider type="none" />}
    </>
  );
}

// cast to original type because of incompatibility generic and memo:
// https://github.com/DefinitelyTyped/DefinitelyTyped/issues/37087
export default React.memo(Item) as typeof Item;
