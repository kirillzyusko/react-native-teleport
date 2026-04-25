import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Portal } from "react-native-teleport";
import { useRoute } from "@react-navigation/native";
import { runOnUI } from "react-native-reanimated";

import AnimatedPopup from "./AnimatedPopup";
import TeleportedView from "./TeleportedView";
import Divider from "./elements/Divider";
import Item from "./elements/Item";
import Label from "./elements/Label";
import Select from "./elements/Select";
import useInsets from "./hooks/useInsets";
import { getAnchorOverflow } from "./layout";
import { useTeleport } from "./teleport/context";
import { useIsMountedRef } from "./utils";

import type { AnimatedPopupRef } from "./AnimatedPopup";
import type {
  AnimationType,
  ContextMenuStyle,
  CoverType,
  Layout,
  Point,
} from "./types";
import type { ReactElement, ReactNode } from "react";

const styles = StyleSheet.create({
  anchorContainer: {
    alignSelf: "flex-start",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

type AnchorProps = {
  children: ReactNode;
};

const Anchor = ({ children }: AnchorProps) => <>{children}</>;

type OptionsProps = {
  children: ReactNode;
};

const Options = ({ children }: OptionsProps) => <>{children}</>;

type Props = {
  style?: ContextMenuStyle;
  animation: AnimationType;
  cover: CoverType;
  blurred?: boolean;
  teleportable?: boolean;
  level?: "screen";
  hostName?: string;
  horizontalMovementRelativeToAnchor?: boolean;
  children: [ReactElement<AnchorProps>, ReactElement<OptionsProps>];
  onClose?: () => void;
};

const pivotPoint: Record<AnimationType, Point> = {
  "bottom-left": { x: 1, y: 0 },
  "bottom-right": { x: 0, y: 0 },
  "top-left": { x: 1, y: 1 },
  "top-right": { x: 0, y: 1 },
};

export type ContextMenuRef = {
  open: () => void;
  close: () => void;
};

export interface ContextMenuComponent
  extends React.ForwardRefExoticComponent<
    Props & React.RefAttributes<ContextMenuRef>
  > {
  Anchor: typeof Anchor;
  Options: typeof Options;
  Item: typeof Item;
  Select: typeof Select;
  Divider: typeof Divider;
  Label: typeof Label;
}

const ContextMenu = forwardRef<ContextMenuRef, Props>((props, ref) => {
  const {
    children,
    cover,
    onClose,
    style = {},
    animation,
    blurred,
    level,
    hostName,
    teleportable,
    horizontalMovementRelativeToAnchor = true,
  } = props;
  const [anchorElement, optionElement] = children;

  const [visible, setVisible] = useState(false);
  const viewRef = useRef<React.ElementRef<typeof View>>(null);
  const animatedPopupRef = useRef<AnimatedPopupRef>(null);
  const layout = useRef<Layout>({ x: 0, y: 0, width: 0, height: 0 });
  const isMounted = useIsMountedRef();
  const { getInsets } = useInsets();
  const { setDestination } = useTeleport();
  const route = useRoute();
  const shouldBeTeleported = teleportable && visible;
  const portalHostName = level === "screen" ? hostName ?? route.key : "overlay";

  const hide = useCallback(() => {
    animatedPopupRef.current?.close();
  }, []);

  const onClosed = useCallback(
    (finished?: boolean) => {
      if (!finished) {
        return;
      }

      if (isMounted.current) {
        setVisible(false);
      }

      onClose?.();
    },
    [isMounted, onClose],
  );

  useEffect(() => {
    const backListener = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (visible) {
          hide();
          return true;
        }

        return false;
      },
    );

    return () => backListener.remove();
  }, [hide, visible]);

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        viewRef.current?.measure(
          (
            _x: number,
            _y: number,
            width: number,
            height: number,
            pageX: number,
            pageY: number,
          ) => {
            layout.current = { x: pageX, y: pageY, width, height };

            if (teleportable) {
              runOnUI(setDestination)(
                {
                  overflow: getAnchorOverflow(
                    getInsets() ?? {},
                    layout.current,
                    animation,
                  ),
                  anchor: layout.current,
                },
                () => {
                  requestAnimationFrame(() => {
                    setVisible(true);
                  });
                },
              );
              return;
            }

            setVisible(true);
          },
        );
      },
      close: hide,
    }),
    [animation, getInsets, hide, setDestination, teleportable],
  );

  return (
    <View ref={viewRef} style={styles.anchorContainer}>
      {teleportable ? (
        <TeleportedView teleported={shouldBeTeleported}>
          {anchorElement}
        </TeleportedView>
      ) : (
        anchorElement
      )}

      {visible ? (
        <Portal hostName={portalHostName}>
          <TouchableOpacity onPress={hide} style={styles.overlay}>
            <View pointerEvents="box-none" style={styles.overlay}>
              <AnimatedPopup
                ref={animatedPopupRef}
                animation={animation}
                blurred={blurred}
                cover={cover}
                horizontalMovementRelativeToAnchor={
                  horizontalMovementRelativeToAnchor
                }
                layout={layout.current}
                onClosed={onClosed}
                pivot={pivotPoint[animation]}
                style={style}
              >
                {optionElement}
              </AnimatedPopup>
            </View>
          </TouchableOpacity>
        </Portal>
      ) : null}
    </View>
  );
}) as ContextMenuComponent;

ContextMenu.Anchor = Anchor;
ContextMenu.Options = Options;
ContextMenu.Item = Item;
ContextMenu.Select = Select;
ContextMenu.Divider = Divider;
ContextMenu.Label = Label;

export default ContextMenu;
