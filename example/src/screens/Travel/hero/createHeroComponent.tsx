import React, { useLayoutEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import { Portal } from "react-native-teleport";
import { useHeroStore } from "./store";
import type { FlatStyle } from "./types";

export const HERO_OVERLAY_HOST = "hero-overlay";

type HeroComponentProps = {
  id: string;
  style?: any;
  children?: React.ReactNode;
  [key: string]: any;
};

// Style properties that are handled by the overlay wrapper (position/size),
// so they should not be interpolated on the component itself.
const LAYOUT_KEYS = new Set([
  "position",
  "left",
  "top",
  "right",
  "bottom",
  "width",
  "height",
]);

const FONT_WEIGHT_MAP: Record<string, number> = {
  normal: 400,
  bold: 700,
  ultralight: 100,
  thin: 200,
  light: 300,
  medium: 500,
  semibold: 600,
  heavy: 800,
  black: 900,
};

/**
 * Converts a style value to a number if possible.
 * Handles fontWeight strings like "bold", "700", etc.
 */
function toNumeric(value: any): number | null {
  "worklet";

  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const mapped = FONT_WEIGHT_MAP[value];
    if (mapped !== undefined) return mapped;
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Given source and target flat styles, returns the keys of properties
 * that can be resolved to numbers in both and have different values.
 */
function getAnimatableKeys(
  source: FlatStyle,
  target: FlatStyle,
): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(source)) {
    if (LAYOUT_KEYS.has(key)) continue;
    const srcNum = toNumeric(source[key]);
    const tgtNum = toNumeric(target[key]);
    if (srcNum !== null && tgtNum !== null && srcNum !== tgtNum) {
      keys.push(key);
    }
  }
  return keys;
}

export function createHeroComponent(Component: React.ComponentType<any>) {
  const AnimatedComponent = Animated.createAnimatedComponent(
    Component as React.ComponentType<any>,
  );

  function HeroComponent({ id, style, children, ...rest }: HeroComponentProps) {
    const ref = useRef<any>(null);

    // Determine role once at mount time
    const roleRef = useRef<"source" | "target">(
      useHeroStore.getState().source[id] !== undefined ? "target" : "source",
    );
    const isSource = roleRef.current === "source";

    const flatStyle = useMemo(
      () => (StyleSheet.flatten(style) ?? {}) as FlatStyle,
      [style],
    );

    // Subscribe to transition state for this hero ID
    const transition = useHeroStore((s) => s.transitions[id]);
    const phase = useHeroStore((s) => s.phase);
    const progress = useHeroStore((s) => s.progress);
    const isTransitioning = phase === "forward" || phase === "backward";

    // Measure and register on mount
    useLayoutEffect(() => {
      const doMeasure = () => {
        ref.current?.measureInWindow(
          (x: number, y: number, w: number, h: number) => {
            if (w === 0 && h === 0) return;
            const role = isSource ? "source" : "target";
            console.log(`[Hero] ${role} "${id}" measured:`, { x, y, width: w, height: h });
            console.log(`[Hero] ${role} "${id}" flatStyle:`, flatStyle);
            const reg = { rect: { x, y, width: w, height: h }, flatStyle };
            if (isSource) {
              useHeroStore.getState().registerSource(id, reg);
            } else {
              useHeroStore.getState().registerTarget(id, reg);
            }
          },
        );
      };
      requestAnimationFrame(doMeasure);

      return () => {
        if (isSource) {
          useHeroStore.getState().unregisterSource(id);
        } else {
          useHeroStore.getState().unregisterTarget(id);
        }
      };
    }, [id, isSource, flatStyle]);

    // Source teleports to overlay during transitions
    const shouldTeleport = isSource && isTransitioning && !!transition;

    // Target is hidden during transitions (overlay handles the animation)
    const isTargetHidden = !isSource && isTransitioning;

    if (transition) {
      console.log(`[Hero] "${id}" transition:`, {
        phase,
        isSource,
        shouldTeleport,
        isTargetHidden,
        sourceRect: transition.sourceRect,
        targetRect: transition.targetRect,
      });
    }

    // Precompute which style keys to animate
    const animatableKeys = useMemo(() => {
      if (!transition?.sourceStyle || !transition?.targetStyle) return [];
      return getAnimatableKeys(transition.sourceStyle, transition.targetStyle);
    }, [transition?.sourceStyle, transition?.targetStyle]);

    // Animated overlay style: interpolate position + size
    const overlayStyle = useAnimatedStyle(() => {
      if (!transition) return {};

      const src = transition.sourceRect;
      const tgt = transition.targetRect ?? src;

      return {
        position: "absolute" as const,
        left: interpolate(progress.value, [0, 1], [src.x, tgt.x]),
        top: interpolate(progress.value, [0, 1], [src.y, tgt.y]),
        width: interpolate(progress.value, [0, 1], [src.width, tgt.width]),
        height: interpolate(progress.value, [0, 1], [src.height, tgt.height]),
      };
    }, [transition]);

    // Animated component style: interpolate differing numeric properties (fontSize, fontWeight, etc.)
    const animatedComponentStyle = useAnimatedStyle(() => {
      if (!transition?.sourceStyle || !transition?.targetStyle) return {};

      const result: Record<string, number> = {};
      for (const key of animatableKeys) {
        const srcVal = toNumeric(transition.sourceStyle[key])!;
        const tgtVal = toNumeric(transition.targetStyle[key])!;
        result[key] = interpolate(progress.value, [0, 1], [srcVal, tgtVal]);
      }
      return result;
    }, [transition, animatableKeys]);

    if (shouldTeleport) {
      return (
        <Portal hostName={HERO_OVERLAY_HOST}>
          <Animated.View style={overlayStyle}>
            <AnimatedComponent
              ref={ref}
              style={[style, styles.fill, animatedComponentStyle]}
              {...rest}
            >
              {children}
            </AnimatedComponent>
          </Animated.View>
        </Portal>
      );
    }

    return (
      <AnimatedComponent
        ref={ref}
        style={[style, isTargetHidden && styles.hidden]}
        {...rest}
      >
        {children}
      </AnimatedComponent>
    );
  }

  return HeroComponent;
}

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
  },
  fill: {
    width: "100%",
    height: "100%",
  },
});
