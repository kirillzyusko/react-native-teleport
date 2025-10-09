import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ScreenNames } from "../../constants/screenNames";
import LottieExample from "../../screens/Lottie";
import GestureHandlerTouchableExample from "../../screens/Touchable";
import RNTouchableExample from "../../screens/RNTouchable";
import DynamicChildrenExample from "../../screens/DynamicChildren";
import InstantRoot from "../../screens/InstantRoot";
import Hook from "../../screens/Hook/Hook";
import FlexibleStyles from "../../screens/FlexibleStyles";
import BottomSheet from "../../screens/BottomSheet";

export type ExamplesStackParamList = {
  [ScreenNames.LOTTIE]: undefined;
  [ScreenNames.GESTURE_HANDLER_TOUCHABLE]: undefined;
  [ScreenNames.REACT_NATIVE_TOUCHABLE]: undefined;
  [ScreenNames.DYNAMIC_CHILDREN]: undefined;
  [ScreenNames.INSTANT_ROOT]: undefined;
  [ScreenNames.HOOKS]: undefined;
  [ScreenNames.FLEXIBLE_STYLES]: undefined;
  [ScreenNames.BOTTOM_SHEET]: undefined;
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
  [ScreenNames.HOOKS]: {
    title: "Hooks",
  },
  [ScreenNames.FLEXIBLE_STYLES]: {
    title: "Flexible styles",
  },
  [ScreenNames.BOTTOM_SHEET]: {
    title: "Bottom sheet",
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
    <Stack.Screen
      component={Hook}
      name={ScreenNames.HOOKS}
      options={options[ScreenNames.HOOKS]}
    />
    <Stack.Screen
      component={FlexibleStyles}
      name={ScreenNames.FLEXIBLE_STYLES}
      options={options[ScreenNames.FLEXIBLE_STYLES]}
    />
    <Stack.Screen
      component={BottomSheet}
      name={ScreenNames.BOTTOM_SHEET}
      options={options[ScreenNames.BOTTOM_SHEET]}
    />
  </Stack.Navigator>
);

export default ExamplesStack;
