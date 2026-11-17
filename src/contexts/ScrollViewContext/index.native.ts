import { ScrollView } from "react-native";

import type { ScrollViewContextValue } from "./types";
import type { Context } from "react";

const ScrollViewContext = ScrollView.Context as Context<ScrollViewContextValue>;

export default ScrollViewContext;
