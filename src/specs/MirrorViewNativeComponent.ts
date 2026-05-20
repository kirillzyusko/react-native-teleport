import { codegenNativeComponent, type ViewProps } from "react-native";

interface NativeProps extends ViewProps {
  name?: string;
  hidesSourceView?: boolean;
  matchesAlpha?: boolean;
  matchesTransform?: boolean;
  matchesPosition?: boolean;
}

export default codegenNativeComponent<NativeProps>("MirrorView", {
  interfaceOnly: true,
});
