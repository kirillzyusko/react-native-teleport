import { codegenNativeComponent, type ViewProps } from "react-native";

interface NativeProps extends ViewProps {
  name?: string;
  mode?: string;
}

export default codegenNativeComponent<NativeProps>("MirrorView", {
  interfaceOnly: true,
});
