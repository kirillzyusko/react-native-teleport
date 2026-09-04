import { useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import styles from "./styles";

import type { ExampleCategory } from "../../types";
import type { FC } from "react";

type Props = {
  selectedCategory: ExampleCategory;
  onCategoryPress: (category: ExampleCategory) => void;
};

type CategoryButtonProps = {
  category: ExampleCategory;
  label: string;
} & Props;

const CategoryButton: FC<CategoryButtonProps> = ({
  category,
  label,
  selectedCategory,
  onCategoryPress,
}) => {
  const selected = category === selectedCategory;
  const onPress = useCallback(
    () => onCategoryPress(category),
    [category, onCategoryPress],
  );

  return (
    <TouchableOpacity
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.button, selected && styles.selectedButton]}
      testID={category}
    >
      <Text style={[styles.text, selected && styles.selectedText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const CategorySelector: FC<Props> = (props) => (
  <View accessibilityRole="tablist" style={styles.container}>
    <CategoryButton category="demo" label="Demos" {...props} />
    <CategoryButton category="fixture" label="Fixtures" {...props} />
  </View>
);

export default CategorySelector;
