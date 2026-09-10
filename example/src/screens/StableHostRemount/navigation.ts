import { createNativeStackNavigator } from "@react-navigation/native-stack";

export type StableHostRemountParamList = {
  Landing: undefined;
  Screen: undefined;
};

export const StableHostRemountStack =
  createNativeStackNavigator<StableHostRemountParamList>();
