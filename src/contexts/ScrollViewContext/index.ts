import { createContext } from "react";
import type { ScrollViewContextValue } from "./types";

const ScrollViewContext = createContext<ScrollViewContextValue>(null);

export default ScrollViewContext;
