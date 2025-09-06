import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";

import { StackNames } from "../constants/screenNames";
import ExampleMain from "../screens/Main/index";
import ExamplesStack, { type ExamplesStackParamList } from "./ExamplesStack";

export type RootStackParamList = {
  [StackNames.EXAMPLES]: undefined;
  [StackNames.EXAMPLES_STACK]: NavigatorScreenParams<ExamplesStackParamList>;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const options = {
  [StackNames.EXAMPLES_STACK]: { headerShown: false },
  [StackNames.EXAMPLES]: { title: "Examples" },
};

const RootStack = () => (
  <Stack.Navigator initialRouteName={StackNames.EXAMPLES}>
    <Stack.Screen
      component={ExampleMain}
      name={StackNames.EXAMPLES}
      options={options[StackNames.EXAMPLES]}
    />
    <Stack.Screen
      component={ExamplesStack}
      name={StackNames.EXAMPLES_STACK}
      options={options[StackNames.EXAMPLES_STACK]}
    />
  </Stack.Navigator>
);

export default RootStack;
