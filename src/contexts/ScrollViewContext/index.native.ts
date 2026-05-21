import type { Context } from "react";
import { ScrollView } from "react-native";
import type { ScrollViewContextValue } from "./types";

const ScrollViewContext = ScrollView.Context as Context<ScrollViewContextValue>;

export default ScrollViewContext;
