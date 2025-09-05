import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ScreenNames } from "../../constants/screenNames";
import LottieExample from "../../screens/Lottie";

export type ExamplesStackParamList = {
  [ScreenNames.LOTTIE]: undefined;
};

const Stack = createNativeStackNavigator<ExamplesStackParamList>();

const options = {
  [ScreenNames.LOTTIE]: {
    title: "Lottie animation",
  },
};

const ExamplesStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      component={LottieExample}
      name={ScreenNames.LOTTIE}
      options={options[ScreenNames.LOTTIE]}
    />
  </Stack.Navigator>
);

export default ExamplesStack;
