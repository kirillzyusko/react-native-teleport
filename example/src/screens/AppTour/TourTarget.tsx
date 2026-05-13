import { useCallback, useRef, type ComponentRef } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Portal } from "react-native-teleport";
import { useTour, type Layout } from "./TourContext";

type Props = {
  id: string;
  children: React.ReactNode;
};

export default function TourTarget({ id, children }: Props) {
  const { activeId, layouts, registerLayout } = useTour();
  const insets = useSafeAreaInsets();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const isActive = activeId === id;
  const layout: Layout | undefined = layouts[id];

  const onLayout = useCallback(() => {
    requestAnimationFrame(() => {
      ref.current?.measure(
        (
          _x: number,
          _y: number,
          width: number,
          height: number,
          pageX: number,
          pageY: number,
        ) => {
          if (!Number.isFinite(pageX) || width === 0) {
            return;
          }
          registerLayout(id, { x: pageX, y: pageY, width, height });
        },
      );
    });
  }, [id, registerLayout]);

  if (isActive && layout) {
    return (
      <>
        <View
          ref={ref}
          onLayout={onLayout}
          collapsable={false}
          style={{ width: layout.width, height: layout.height }}
        />
        <Portal hostName="overlay" name={`tour-${id}`}>
          <View
            pointerEvents="none"
            style={[
              styles.teleported,
              {
                left: layout.x,
                top: layout.y + insets.top,
                width: layout.width,
                height: layout.height,
              },
            ]}
          >
            {children}
          </View>
        </Portal>
      </>
    );
  }

  return (
    <View ref={ref} onLayout={onLayout} collapsable={false}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  teleported: {
    position: "absolute",
  },
});
