import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";

import { ScreenNames } from "../../constants/screenNames";
import GestureHandlerTouchableExample from "../../screens/Touchable";
import RNTouchableExample from "../../screens/RNTouchable";
import DynamicChildrenExample from "../../screens/DynamicChildren";
import InstantRoot from "../../screens/InstantRoot";
import Hook from "../../screens/Hook/Hook";
import FlexibleStyles from "../../screens/FlexibleStyles";
import BottomSheet from "../../screens/BottomSheet";
import Messenger from "../../screens/Messenger";
import PortalBeforeHost from "../../screens/PortalBeforeHost";
import InstagramFeed from "../../screens/Instagram/Feed";
import InstagramReels from "../../screens/Instagram/Reels";
import DeepNavigation from "../../screens/DeepNavigation/Screen1";
import DeepNavigationNested from "../../screens/DeepNavigation/Screen2";
import TravelExplore from "../../screens/Travel/Explore";
import TravelDetails from "../../screens/Travel/Details";
import type { PostType } from "../../screens/Instagram/posts";
import type { ImageProps } from "react-native";
import TeleportationOrder from "../../screens/TeleportationOrder";

export type ExamplesStackParamList = {
  [ScreenNames.GESTURE_HANDLER_TOUCHABLE]: undefined;
  [ScreenNames.REACT_NATIVE_TOUCHABLE]: undefined;
  [ScreenNames.DYNAMIC_CHILDREN]: undefined;
  [ScreenNames.INSTANT_ROOT]: undefined;
  [ScreenNames.HOOKS]: undefined;
  [ScreenNames.FLEXIBLE_STYLES]: undefined;
  [ScreenNames.BOTTOM_SHEET]: undefined;
  [ScreenNames.MESSENGER]: undefined;
  [ScreenNames.PORTAL_BEFORE_HOST]: undefined;
  [ScreenNames.INSTAGRAM_FEED]: undefined;
  [ScreenNames.INSTAGRAM_REELS]: {
    post: PostType;
  };
  [ScreenNames.NAVIGATION_LIFECYCLE]: undefined;
  [ScreenNames.NAVIGATION_LIFECYCLE_NESTED]: undefined;
  [ScreenNames.TRAVEL_EXPLORE]: undefined;
  [ScreenNames.TRAVEL_DETAILS]: {
    image: ImageProps["source"];
    header: string;
    text: string;
    location: string;
    rating: string;
  };
  [ScreenNames.TELEPORTATION_ORDER]: undefined;
};

const Stack = createNativeStackNavigator<ExamplesStackParamList>();

const options = {
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
  [ScreenNames.MESSENGER]: {
    title: "Messenger",
  },
  [ScreenNames.PORTAL_BEFORE_HOST]: {
    title: "Portal Before Host",
  },
  [ScreenNames.INSTAGRAM_FEED]: {
    headerShown: false,
  },
  [ScreenNames.INSTAGRAM_REELS]: {
    headerShown: false,
    animation: "none" as const,
    presentation: "transparentModal" as const,
  },
  [ScreenNames.NAVIGATION_LIFECYCLE]: {
    title: "Navigation/Lifecycle",
  },
  [ScreenNames.NAVIGATION_LIFECYCLE_NESTED]: {
    title: "Navigation/Lifecycle",
  },
  [ScreenNames.TRAVEL_EXPLORE]: {
    headerShown: false,
  },
  [ScreenNames.TRAVEL_DETAILS]: {
    headerShown: false,
  },
  [ScreenNames.TELEPORTATION_ORDER]: {
    title: "Teleportation order",
  },
};

const ExamplesStack = () => (
  <Stack.Navigator>
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
    <Stack.Screen
      component={Messenger}
      name={ScreenNames.MESSENGER}
      options={options[ScreenNames.MESSENGER]}
    />
    <Stack.Screen
      component={PortalBeforeHost}
      name={ScreenNames.PORTAL_BEFORE_HOST}
      options={options[ScreenNames.PORTAL_BEFORE_HOST]}
    />
    <Stack.Screen
      component={InstagramFeed}
      name={ScreenNames.INSTAGRAM_FEED}
      options={options[ScreenNames.INSTAGRAM_FEED]}
    />
    <Stack.Screen
      component={InstagramReels}
      name={ScreenNames.INSTAGRAM_REELS}
      options={options[ScreenNames.INSTAGRAM_REELS]}
    />
    <Stack.Screen
      component={DeepNavigation}
      name={ScreenNames.NAVIGATION_LIFECYCLE}
      options={options[ScreenNames.NAVIGATION_LIFECYCLE]}
    />
    <Stack.Screen
      component={DeepNavigationNested}
      name={ScreenNames.NAVIGATION_LIFECYCLE_NESTED}
      options={options[ScreenNames.NAVIGATION_LIFECYCLE_NESTED]}
    />
    <Stack.Screen
      component={TravelExplore}
      name={ScreenNames.TRAVEL_EXPLORE}
      options={options[ScreenNames.TRAVEL_EXPLORE]}
    />
    <Stack.Screen
      component={TravelDetails}
      name={ScreenNames.TRAVEL_DETAILS}
      options={options[ScreenNames.TRAVEL_DETAILS]}
    />
    <Stack.Screen
      component={TeleportationOrder}
      name={ScreenNames.TELEPORTATION_ORDER}
      options={options[ScreenNames.TELEPORTATION_ORDER]}
    />
  </Stack.Navigator>
);

export type ExamplesStackNavigation =
  NativeStackNavigationProp<ExamplesStackParamList>;

export default ExamplesStack;
