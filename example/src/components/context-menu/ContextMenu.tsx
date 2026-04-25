import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {BackHandler, View} from 'react-native';
import {TouchableWithoutFeedback} from 'react-native-gesture-handler';
import {Portal} from '@gorhom/portal';
import {useRoute} from '@react-navigation/native';
import {runOnUI} from 'react-native-reanimated';

import {useEvent, useIsMountedRef} from '../../../modules/library';
import {commonStyle} from '../../../styles/common';
import {createStyle} from '../../../styles/utils';

import AnimatedPopup from './AnimatedPopup';
import TeleportedView from './TeleportedView';
import Divider from './elements/Divider';
import Item from './elements/Item';
import Select from './elements/Select';
import Switch from './elements/Switch';
import Label from './elements/Label';
import {useTeleport} from './teleport/context';
import {getAnchorOverflow} from './layout';
import useInsets from './hooks/useInsets';

import type {AnimatedPopupRef} from './AnimatedPopup';
import type {AnimationType, ContextMenuStyle, CoverType, Layout, Point} from './types';
import type {ReactElement, ReactNode} from 'react';

const styles = createStyle({
  container: {
    ...commonStyle.absolute,
    flex: 1,
  },
});

type AnchorProps = {
  children: ReactNode;
};

const Anchor = ({children}: AnchorProps) => <>{children}</>;

type OptionsProps = {
  children: ReactNode;
};

const Options = ({children}: OptionsProps) => <>{children}</>;

type Props = {
  style?: ContextMenuStyle;
  /**
   * Defines final point of the animation.
   */
  animation: AnimationType;
  /**
   * Defines anchor point of the animation (relatively to anchor element).
   */
  cover: CoverType;
  /**
   * A boolean prop indicating whether "closeable" area should be blurred or not.
   * Disabled by default.
   */
  blurred?: boolean;
  /**
   * A boolean prop indicating whether anchor element should be teleported to
   * non-blurred area or not. Disabled by default.
   */
  teleportable?: boolean;
  /**
   * Which level to use for rendering ContextMenu. If the value is not specified, then it will use
   * "root" level by default. If you want to render it on screen level, then you will need to specify
   * "screen".
   */
  level?: 'screen';
  /**
   * Whether to move context menu by horizontal axis during an animation. Creates nice parallax
   * effect, which looks great, if the anchor is smaller than the context menu. Otherwise it
   * may look slightly strange, since anchor point will not be fixed. `true` by default.
   */
  horizontalMovementRelativeToAnchor?: boolean;
  children: [
    ReactElement<AnchorProps>,
    ReactElement<OptionsProps>
  ];
  onClose?: () => void;
};

const PivotPoint: Record<AnimationType, Point> = {
  'bottom-left': {x: 1, y: 0},
  'bottom-right': {x: 0, y: 0},
  'top-left': {x: 1, y: 1},
  'top-right': {x: 0, y: 1},
};

export type ContextMenuRef = {
  open: () => void;
  close: () => void;
}

export interface ContextMenuComponent extends React.ForwardRefExoticComponent<Props & React.RefAttributes<ContextMenuRef>> {
  Anchor: typeof Anchor;
  Options: typeof Options;
  Item: typeof Item;
  Select: typeof Select;
  Divider: typeof Divider;
  Switch: typeof Switch;
  Label: typeof Label;
}

const ContextMenu = forwardRef<ContextMenuRef, Props>((props, ref) => {
  const {
    children, level, cover, onClose, style = {}, animation, blurred, teleportable,
    horizontalMovementRelativeToAnchor = true,
  } = props;
  const [anchorElement, optionElement] = children;

  const [visible, setVisible] = useState(false);
  const viewRef = useRef<View>(null);
  const animatedPopupRef = useRef<AnimatedPopupRef>(null);
  const layout = useRef<Layout>({x: 0, y: 0, width: 0, height: 0});
  const unmount = useRef<() => void>();
  const isMounted = useIsMountedRef();
  const {getInsets} = useInsets();
  const {key} = useRoute();
  const {setDestination} = useTeleport();
  const shouldBeTeleported = teleportable && visible;

  const onClosed = useCallback((finished) => {
    if (finished) {
      // if component is still mounted, then we simply change state and portal
      // will be closed. If it's unmounted, then we don't need to change the
      // state, since it's not possible to change a state on unmounted component
      // and react will throw a warning
      if (isMounted.current) {
        setVisible(false);
      }

      if (onClose) {
        onClose();
      }

      // in case if component was already unmounted, then we will have "unmount"
      // trigger and we call it here
      if (unmount.current) {
        unmount.current();
      }
    }
  }, []);
  const hide = useCallback(() => {
    animatedPopupRef.current?.close?.();
  }, []);
  // this function will be called when component gets unmounted and allow us
  // to define custom behavior for reaction on this event
  const saveUnmountOrCallIt = useEvent((_unmount: () => void) => {
    // since parent component can be unmounted we preserve unmount function
    // to call it later. It's needed to prevent portal unmounting in case
    // if parent component is unmounted before context menu is closed
    if (visible) {
      unmount.current = _unmount;
    } else {
      _unmount();
    }
  });

  useEffect(() => {
    const backListener = BackHandler.addEventListener('hardwareBackPress', () => {
      return visible;
    });

    return () => backListener.remove();
  }, [visible]);

  useImperativeHandle(ref, () => ({
    open: () => {
      viewRef.current?.measure((x, y, width, height, pageX, pageY) => {
        layout.current = {x: pageX, y: pageY, width, height};
        // if view is teleportable, then we need to update `destination`, with corresponding values
        // but since js -> native thread -> js communication will require additional CPU resources,
        // we are using if statement (think about it as optimization).
        // Note that we can not perform two async operations at the same time (i. e. call
        // setDestination(...); setVisible(true)) since it will cause race condition and view blinks
        if (teleportable) {
          runOnUI(setDestination)(
            {
              overflow: getAnchorOverflow(getInsets(), layout.current, animation),
              anchor: layout.current,
            },
            () => {
              // to avoid race conditions let's schedule an update in next iteration
              requestAnimationFrame(() => {
                setVisible(true);
              });
            }
          );
        } else {
          setVisible(true);
        }
      });
    },
    close: hide,
  }), []);

  return (
    <View ref={viewRef}>
      {
        teleportable
        ? <TeleportedView teleported={shouldBeTeleported}>
            {anchorElement}
          </TeleportedView>
        : anchorElement
      }
      {
        visible &&
        <Portal hostName={level === 'screen' ? key : undefined} handleOnUnmount={saveUnmountOrCallIt}>
          <TouchableWithoutFeedback containerStyle={styles.container} onPress={hide}>
            <AnimatedPopup
              ref={animatedPopupRef}
              style={style}
              layout={layout.current}
              cover={cover}
              pivot={PivotPoint[animation]}
              animation={animation}
              blurred={blurred}
              horizontalMovementRelativeToAnchor={horizontalMovementRelativeToAnchor}
              onClosed={onClosed}
            >
              {optionElement}
            </AnimatedPopup>
          </TouchableWithoutFeedback>
        </Portal>
      }
    </View>
  );
}) as ContextMenuComponent;

// containers
ContextMenu.Anchor = Anchor;
ContextMenu.Options = Options;

// elements
ContextMenu.Item = Item;
ContextMenu.Select = Select;
ContextMenu.Divider = Divider;
ContextMenu.Switch = Switch;
ContextMenu.Label = Label;

export default ContextMenu;
