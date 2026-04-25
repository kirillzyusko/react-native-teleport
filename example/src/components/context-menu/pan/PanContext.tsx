import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  GestureEventPayload,
  PanGestureHandler,
  PanGestureHandlerEventPayload,
} from "react-native-gesture-handler";
import Reanimated, {
  GestureHandlers,
  useAnimatedGestureHandler,
  useSharedValue,
} from "react-native-reanimated";

export type PanContextType = {
  set: (handlers: Handlers) => void;
};

export type Event = GestureEventPayload & PanGestureHandlerEventPayload;
type AvailableEventHandlers = keyof GestureHandlers<unknown, {}>;
type Handler = Partial<Record<AvailableEventHandlers, (event: Event) => void>>;
type Handlers = Record<string, Handler | undefined>;

export const PanContext = React.createContext<PanContextType>({
  set: () => ({}),
});

type Props = {
  children: React.ReactNode;
};

export function usePanHandler(handler: Handler, key: string) {
  const context = useContext(PanContext);

  useEffect(() => {
    context.set({ [key]: handler });

    return () => {
      context.set({ [key]: undefined });
    };
  }, [handler]);
}

function PanContextProvider(props: Props) {
  const { children } = props;

  const workletListeners = useSharedValue<Handlers>({});
  const jsListeners = useRef<Handlers>({});
  // since js -> worklet -> js call is asynchronous, we can not write listeners
  // straight into shared variable (using current shared value as a previous result),
  // since there may be a race condition in a call, and closure may have out-of-dated
  // values. As a result, some of handlers may be not written to "all handlers" object.
  // Below we are writing all listeners to `ref` and afterwards synchronize them with
  // shared value (since `refs` are not referring to actual value in worklets).
  // This approach allow us to update synchronously handlers in js thread (and it assures,
  // that it will have all of them) and then update them in worklet thread (calls are
  // happening in FIFO order, so we will always have actual value).
  const updateSharedListeners = () => {
    workletListeners.value = jsListeners.current;
  };
  const setListeners = useCallback((handler: Handlers) => {
    jsListeners.current = {
      ...jsListeners.current,
      ...handler,
    };
    updateSharedListeners();
  }, []);
  const broadcast = (type: AvailableEventHandlers, event: Event) => {
    "worklet";

    Object.keys(workletListeners.value).forEach((key) =>
      workletListeners.value[key]?.[type]?.(event),
    );
  };
  const handler = useAnimatedGestureHandler({
    onStart: (event) => {
      broadcast("onStart", event);
    },
    onActive: (event) => {
      broadcast("onActive", event);
    },
    onCancel: (event) => {
      broadcast("onCancel", event);
    },
    onFinish: (event) => {
      broadcast("onFinish", event);
    },
    onFail: (event) => {
      broadcast("onFail", event);
    },
    onEnd: (event) => {
      broadcast("onEnd", event);
    },
  });
  const value = useMemo(() => ({ set: setListeners }), []);

  return (
    <PanContext.Provider value={value}>
      <PanGestureHandler onGestureEvent={handler}>
        <Reanimated.View>{children}</Reanimated.View>
      </PanGestureHandler>
    </PanContext.Provider>
  );
}

export default PanContextProvider;
