import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import {
  useNavigation,
  type CompositeNavigationProp,
} from "@react-navigation/native";

import { MainScreenNames, StackNames } from "../../constants/screenNames";

import CategorySelector from "./components/CategorySelector";
import ExampleLink from "./components/ExampleLink";
import { demos, fixtures } from "./constants";

import type { RootStackParamList } from "../../navigation/index";
import type { Example, ExampleCategory, ExampleScreen } from "./types";

export type MainStackParamList = {
  [MainScreenNames.DEMOS]: undefined;
  [MainScreenNames.FIXTURES]: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollViewContainer: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
});

type Navigation = CompositeNavigationProp<
  NativeStackNavigationProp<MainStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type ExamplesProps = {
  category: ExampleCategory;
  examples: Example[];
};

const Examples = ({ category, examples }: ExamplesProps) => {
  const navigation = useNavigation<Navigation>();
  const onExamplePress = useCallback(
    (info: ExampleScreen) =>
      navigation.navigate(StackNames.EXAMPLES_STACK, {
        screen: info,
      }),
    [navigation],
  );
  const onCategoryPress = useCallback(
    (nextCategory: ExampleCategory) => {
      navigation.navigate(
        nextCategory === "demo"
          ? MainScreenNames.DEMOS
          : MainScreenNames.FIXTURES,
      );
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <CategorySelector
        onCategoryPress={onCategoryPress}
        selectedCategory={category}
      />
      <ScrollView
        contentContainerStyle={styles.scrollViewContainer}
        testID="main_scroll_view"
      >
        {examples.map((example, index) => (
          <ExampleLink
            key={example.title}
            index={index + 1}
            onPress={onExamplePress}
            {...example}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const Demos = () => <Examples category="demo" examples={demos} />;

const Fixtures = () => <Examples category="fixture" examples={fixtures} />;

const ExampleMain = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen component={Demos} name={MainScreenNames.DEMOS} />
    <Stack.Screen component={Fixtures} name={MainScreenNames.FIXTURES} />
  </Stack.Navigator>
);

export default ExampleMain;
