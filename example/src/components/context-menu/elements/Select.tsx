import LottieView from "lottie-react-native";
import React from "react";

import Checkmark from "../../../../../assets/animations/checkmark.json";

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
  return <LottieView source={Checkmark} speed={3} loop={false} autoPlay />;
}

function Select<T>(props: SelectProps<T>) {
  const { isChecked, onChange, ...other } = props;

  return (
    <Item
      {...other}
      onPress={onChange}
      iconComponent={isChecked && AnimatedCheckmark}
    />
  );
}

export default Select;
