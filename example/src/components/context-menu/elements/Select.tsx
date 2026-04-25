import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";

import Item from "./Item";

import type { ItemBaseProps } from "./Item";

type BaseSelectProps = {
  isChecked?: boolean;
} & Omit<ItemBaseProps, "icon">;

type SelectPropsNoItem = {
  item?: undefined;
  onChange: () => void;
};

type SelectPropsWithItem<T> = {
  item: T;
  onChange: (item: T) => void;
};

type SelectProps<T> = (SelectPropsNoItem | SelectPropsWithItem<T>) &
  BaseSelectProps;

function AnimatedCheckmark() {
  return (
    <FontAwesome6 color="#16a34a" iconStyle="solid" name="check" size={16} />
  );
}

function Select<T>(props: SelectProps<T>) {
  const { isChecked, onChange } = props;
  const iconComponent = isChecked ? AnimatedCheckmark : undefined;

  if ("item" in props && typeof props.item !== "undefined") {
    return (
      <Item
        disabled={props.disabled}
        iconComponent={iconComponent}
        iconName={props.iconName}
        isLast={props.isLast}
        item={props.item}
        onPress={onChange}
        title={props.title}
        type={props.type}
      />
    );
  }

  return (
    <Item
      disabled={props.disabled}
      iconComponent={iconComponent}
      iconName={props.iconName}
      isLast={props.isLast}
      onPress={onChange as () => void}
      title={props.title}
      type={props.type}
    />
  );
}

export default Select;
