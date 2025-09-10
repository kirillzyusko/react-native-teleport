import { ScreenNames } from "../../constants/screenNames";

import type { Example } from "./types";

export const examples: Example[] = [
  {
    title: "Lottie",
    testID: "lottie",
    info: ScreenNames.LOTTIE,
    icons: "⚠️ 🎞",
  },
  {
    title: "GestureHandler Touchable",
    testID: "gesture_handler_touchable",
    info: ScreenNames.GESTURE_HANDLER_TOUCHABLE,
    icons: "👆🧬",
  },
  {
    title: "React Native Touchable",
    testID: "react_native_touchable",
    info: ScreenNames.REACT_NATIVE_TOUCHABLE,
    icons: "👆🔮",
  },
  {
    title: "Dynamic children",
    testID: "dynamic_children",
    info: ScreenNames.DYNAMIC_CHILDREN,
    icons: "🌀",
  },
];
