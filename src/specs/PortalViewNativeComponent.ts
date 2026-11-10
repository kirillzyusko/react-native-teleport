import { codegenNativeComponent, type ViewProps } from "react-native";
import type { CodegenTypes } from "react-native";

interface NativeProps extends ViewProps {
  stackOrder?: CodegenTypes.WithDefault<CodegenTypes.Int32, -2147483648>;
  mountOrder?: CodegenTypes.Int32;
  name?: string;
  hostName?: string;
}

export default codegenNativeComponent<NativeProps>("PortalView", {
  interfaceOnly: true,
});
