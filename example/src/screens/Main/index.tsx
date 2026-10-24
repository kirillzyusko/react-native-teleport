import { useCallback } from "react";
import { StyleSheet } from "react-native";
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

import ExampleLink from "./components/ExampleLink";
import { demos, fixtures } from "./constants";

import type { RootStackParamList } from "../../navigation/index";
import type { Example, ExampleScreen } from "./types";

export type MainStackParamList = {
  [MainScreenNames.CATEGORIES]: undefined;
  [MainScreenNames.DEMOS]: undefined;
  [MainScreenNames.FIXTURES]: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

const styles = StyleSheet.create({
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
  examples: Example[];
};

const Categories = () => {
  const navigation = useNavigation<Navigation>();
  const onCategoryPress = useCallback(
    (screen: MainScreenNames.DEMOS | MainScreenNames.FIXTURES) =>
      navigation.navigate(screen),
    [navigation],
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollViewContainer}>
      <ExampleLink
        icons="🎨"
        index={1}
        info={MainScreenNames.DEMOS}
        onPress={onCategoryPress}
        testID="demo"
        title="Demos"
      />
      <ExampleLink
        icons="🧪"
        index={2}
        info={MainScreenNames.FIXTURES}
        onPress={onCategoryPress}
        testID="fixture"
        title="Fixtures"
      />
    </ScrollView>
  );
};

const Examples = ({ examples }: ExamplesProps) => {
  const navigation = useNavigation<Navigation>();
  const onExamplePress = useCallback(
    (info: ExampleScreen) =>
      navigation.navigate(StackNames.EXAMPLES_STACK, {
        screen: info,
      }),
    [navigation],
  );

  return (
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
  );
};

const Demos = () => <Examples examples={demos} />;

const Fixtures = () => <Examples examples={fixtures} />;

const ExampleMain = () => (
  <Stack.Navigator
    screenOptions={{
      fullScreenGestureEnabled: true,
      gestureEnabled: true,
      headerShown: false,
    }}
  >
    <Stack.Screen component={Categories} name={MainScreenNames.CATEGORIES} />
    <Stack.Screen component={Demos} name={MainScreenNames.DEMOS} />
    <Stack.Screen component={Fixtures} name={MainScreenNames.FIXTURES} />
  </Stack.Navigator>
);

export default ExampleMain;
