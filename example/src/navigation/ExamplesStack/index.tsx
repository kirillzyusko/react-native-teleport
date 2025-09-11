import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ScreenNames } from "../../constants/screenNames";
import LottieExample from "../../screens/Lottie";
import GestureHandlerTouchableExample from "../../screens/Touchable";
import RNTouchableExample from "../../screens/RNTouchable";
import DynamicChildrenExample from "../../screens/DynamicChildren";
import InstantRoot from "../../screens/InstantRoot";

export type ExamplesStackParamList = {
  [ScreenNames.LOTTIE]: undefined;
  [ScreenNames.GESTURE_HANDLER_TOUCHABLE]: undefined;
  [ScreenNames.REACT_NATIVE_TOUCHABLE]: undefined;
  [ScreenNames.DYNAMIC_CHILDREN]: undefined;
  [ScreenNames.INSTANT_ROOT]: undefined;
};

const Stack = createNativeStackNavigator<ExamplesStackParamList>();

const options = {
  [ScreenNames.LOTTIE]: {
    title: "Lottie animation",
  },
  [ScreenNames.GESTURE_HANDLER_TOUCHABLE]: {
    title: "GestureHandler Touchable",
  },
  [ScreenNames.REACT_NATIVE_TOUCHABLE]: {
    title: "RN Touchable",
  },
  [ScreenNames.DYNAMIC_CHILDREN]: {
    title: "Dynamic children",
  },
  [ScreenNames.INSTANT_ROOT]: {
    title: "Instant root",
  },
};

const ExamplesStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      component={LottieExample}
      name={ScreenNames.LOTTIE}
      options={options[ScreenNames.LOTTIE]}
    />
    <Stack.Screen
      component={GestureHandlerTouchableExample}
      name={ScreenNames.GESTURE_HANDLER_TOUCHABLE}
      options={options[ScreenNames.GESTURE_HANDLER_TOUCHABLE]}
    />
    <Stack.Screen
      component={RNTouchableExample}
      name={ScreenNames.REACT_NATIVE_TOUCHABLE}
      options={options[ScreenNames.REACT_NATIVE_TOUCHABLE]}
    />
    <Stack.Screen
      component={DynamicChildrenExample}
      name={ScreenNames.DYNAMIC_CHILDREN}
      options={options[ScreenNames.DYNAMIC_CHILDREN]}
    />
    <Stack.Screen
      component={InstantRoot}
      name={ScreenNames.INSTANT_ROOT}
      options={options[ScreenNames.INSTANT_ROOT]}
    />
  </Stack.Navigator>
);

export default ExamplesStack;
