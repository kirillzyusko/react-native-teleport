import React, { useLayoutEffect, useRef } from "react";
import {
  Text,
  Image,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  StyleSheet,
} from "react-native";
import { create } from "zustand";

type HeroComponentProps = {
  id: string;
};

type SupportedViewProps = {
  onLayout?: (event: LayoutChangeEvent) => void;
};

type HeroStore = {
  source: Record<string, LayoutRectangle | undefined>;
  target: Record<string, LayoutRectangle | undefined>;
  addHeroElement: (id: string, rect: LayoutRectangle) => void;
  clearHeroElement: (id: string) => void;
};

const useHeroStore = create<HeroStore>((set, get) => ({
  source: {},
  target: {},
  addHeroElement: (id: string, rect: LayoutRectangle) => {
    const { source, target } = get();
    if (source[id]) {
      set({ target: { ...target, [id]: rect } });
    } else {
      set({ source: { ...source, [id]: rect } });
    }
    console.log("added", get());
  },
  clearHeroElement: (id: string) => {
    const { source, target } = get();
    if (target[id]) {
      set({ target: { ...target, [id]: undefined } });
    } else {
      set({ source: { ...source, [id]: undefined } });
    }
    console.log("cleared", get());
  },
}));

function createHeroComponent<T extends SupportedViewProps>(
  Component: React.ComponentType<T>,
) {
  function HeroComponent({
    id,
    onLayout: onLayoutProp,
    style,
    children,
    ...rest
  }: HeroComponentProps) {
    const ref = useRef();
    const isSourceRef = useRef(
      useHeroStore.getState().source[id] === undefined,
    );
    const addHeroElement = useHeroStore((state) => state.addHeroElement);
    const clearHeroElement = useHeroStore((state) => state.clearHeroElement);
    const onLayout = (e: LayoutChangeEvent) => {
      // addHeroElement(id, e.nativeEvent.layout);
      onLayoutProp?.(e);
    };

    useLayoutEffect(() => {
      ref.current.measureInWindow((x, y, width, height) => {
        addHeroElement(id, { x, y, width, height });
      });

      return () => {
        clearHeroElement(id);
      };
    }, [addHeroElement, id]);

    return (
      <Component
        ref={ref}
        onLayout={onLayout}
        style={[style, !isSourceRef.current && styles.hidden]}
        {...rest}
      />
    );
  }

  return HeroComponent;
}

const Hero = {
  Text: createHeroComponent(Text),
  Image: createHeroComponent(Image),
  View: createHeroComponent(View),
};

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
  },
});

export default Hero;
