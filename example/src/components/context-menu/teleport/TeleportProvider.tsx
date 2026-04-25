import React, {useCallback, useMemo} from 'react';
import {View} from 'react-native';
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  useWorkletCallback,
} from 'react-native-reanimated';
import {PortalDestination} from '@alexzunik/rn-native-portals-reborn';

import {commonStyle} from '../../../../styles/common';

import {TeleportContext, defaultDestination} from './context';

import type {Destination} from '../types';

type Props = {};

/**
 * "Native" portals that can transfer a view in a native hierarchy (aka real DOM) without
 * remounting React component in JS thread.
 * To avoid confusion in terminology with JS portals I decided to call it "Teleport".
 * This element should be used on top of the view hierarchy to overlap all remaining content.
 */
const TeleportProvider: React.FC<Props> = ({children}) => {
  const destination = useSharedValue(defaultDestination);
  const progress = useSharedValue(0);
  const setDestination = useWorkletCallback((target: Partial<Destination>, callback?: () => void) => {
    destination.value = {
      ...destination.value,
      ...target
    };

    if (callback) {
      runOnJS(callback)();
    }
  }, []);
  const resetDestination = useCallback(() => {
    destination.value = defaultDestination;
  }, []);
  const context = useMemo(() => ({progress, destination, setDestination, resetDestination}), []);

  const translateY = useDerivedValue(() => Math.min(destination.value.anchor.height - destination.value.overflow.height - destination.value.overflow.bottom, destination.value.anchor.height - destination.value.overflow.height - destination.value.overflow.top), []);
  const movement = useAnimatedStyle(() => {
    // we can't interpolate `height` from 0 to 1, since our `translationY` can push view faster, so height
    // increasing should partially match translation process. Here our `fullHeightInProgressScale` will be
    // in range of [0, 1]. Let's imagine, that we need to push view by 100px, but only 20px of the view are
    // covered by insets. In this case, we should interpolate height between [0, 0.2]. That's exactly what
    // this formula does. Math.min(value || 0, 1) is needed to exclude cases, when value is NaN, Infinity
    const fullHeightInProgressScale = Math.min((destination.value.overflow.top + destination.value.overflow.bottom) / Math.abs(destination.value.top) || 0, 1);
    // TODO: in case of top animation we should add top?
    const fullHeight = destination.value.overflow.bottom !== 0 && destination.value.overflow.top !== 0 ? destination.value.overflow.height + destination.value.overflow.bottom : destination.value.overflow.height + destination.value.overflow.top + destination.value.overflow.bottom;
    const height = interpolate(progress.value, [0, fullHeightInProgressScale], [destination.value.overflow.height, fullHeight], Extrapolate.CLAMP);
    const top = interpolate(progress.value, [0, 1], [destination.value.anchor.y + destination.value.overflow.top, destination.value.anchor.y], Extrapolate.CLAMP);
    console.log(
      1111,
      {
        value: progress.value,
        currentHeight: height,
        invisiblePartY: destination.value.overflow.top,
        top,
        anchor: destination.value.anchor,
        translateY,
      }
    );

    return {
      // if view is flicking - most likely we change `overflow` to `hidden` too early
      overflow: height !== 0 ? 'hidden' : undefined,
      // in case if view is covered from top - we need to reverse height animation (default animation goes from top to bottom)
      // for that we are changing top position of container and additionally move child via `top` property
      top,
      left: destination.value.anchor.x,
      width: destination.value.anchor.width,
      height,
      transform: [
        // move entire popup
        {
          translateY: interpolate(progress.value, [0, 1], [0, destination.value.top]),
        },
        // for large content, that goes beyond screen borders from both sides
        // we apply an additional translationY that moves the content into the "visible/cutout area"
        {
          translateY: translateY.value,
        }
      ]
    };
  }, []);
  const relative = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      // handles height animation from top
      top: interpolate(progress.value, [0, 1], [-destination.value.overflow.top, 0], Extrapolate.CLAMP),
      transform: [
        // here we are applying reverse `translateY` to avoid content jumping
        {
          translateY: -translateY.value,
        }
      ]
    };
  }, []);

  return (
    <TeleportContext.Provider value={context}>
      {children}
      <View style={commonStyle.absoluteRelative} pointerEvents="box-none">
        <Animated.View style={movement}>
          <Animated.View style={relative}>
            <PortalDestination name="teleport" />
          </Animated.View>
        </Animated.View>
      </View>
    </TeleportContext.Provider>
  );
};

export default TeleportProvider;
