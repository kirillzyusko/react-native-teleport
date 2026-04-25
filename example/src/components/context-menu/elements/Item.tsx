import React from "react";
import { Pressable, Text, View } from "react-native";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";

import { COLORS } from "../theme";
import Divider from "./Divider";
import commonStyles from "./styles";

import type { TextStyle } from "react-native";

enum ItemVariants {
  DEFAULT = "default",
  DANGER = "danger",
}

type ItemType = `${ItemVariants}`;
export type MenuIconName = "reply" | "share" | "bookmark" | "trash" | "check";

export type ItemBaseProps = {
  type?: ItemType;
  title: string;
  isLast?: boolean;
  disabled?: boolean;
  iconName?: MenuIconName;
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
    color: COLORS.danger,
  },
};

const iconColor = {
  [ItemVariants.DEFAULT]: COLORS.text,
  [ItemVariants.DANGER]: COLORS.danger,
};

const styles = {
  icon: {
    marginLeft: 24,
    height: 20,
    width: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  disabled: {
    opacity: 0.48,
  },
} as const;

function Item<T>(props: ItemProps<T>) {
  const {
    title,
    item,
    disabled = false,
    type = ItemVariants.DEFAULT,
    isLast,
    iconName,
    iconComponent: IconComponent,
    onPress,
  } = props;

  const textStyle = [
    commonStyles.text,
    typeStyles[type],
    disabled && styles.disabled,
  ];
  const iconStyle = [styles.icon, disabled && styles.disabled];

  const handlePress = () => {
    if (disabled) {
      return;
    }

    if (typeof item === "undefined") {
      (onPress as () => void)();
      return;
    }

    (onPress as (value: T) => void)(item);
  };

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          commonStyles.container,
          pressed && { backgroundColor: COLORS.backgroundPressed },
        ]}
      >
        <Text style={textStyle}>{title}</Text>

        <View style={iconStyle}>
          {iconName ? (
            <FontAwesome6
              color={iconColor[type]}
              iconStyle="solid"
              name={iconName}
              size={18}
            />
          ) : null}
          {IconComponent ? <IconComponent /> : null}
        </View>
      </Pressable>

      {!isLast ? <Divider /> : null}
    </>
  );
}

export default React.memo(Item) as typeof Item;
