import { Platform, type View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MeasureCallback = (x: number, y: number) => void;

const useMeasure = (viewRef: React.RefObject<View | null>) => {
  const insets = useSafeAreaInsets();

  return (callback: MeasureCallback) => {
    // @ts-expect-error
    viewRef.current?.measureInWindow((x: number, y: number) => {
      // it looks like enabled edge-to-edge (Android 16+) produces incorrect
      // measurement offset
      if (Platform.OS === "android") {
        return callback(x, y + insets.top);
      }

      return callback(x, y);
    });
  };
};

export default useMeasure;
