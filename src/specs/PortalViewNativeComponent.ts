import { codegenNativeComponent, type ViewProps } from "react-native";
import type { CodegenTypes } from "react-native";

interface NativeProps extends ViewProps {
  // Keep the omitted-prop sentinel distinct from the public default priority 0.
  stackOrder?: CodegenTypes.WithDefault<CodegenTypes.Int32, -2147483648>;
  // Internal committed opening order, independent of user-supplied priority.
  mountOrder?: CodegenTypes.Int32;
  name?: string;
  hostName?: string;
}

export default codegenNativeComponent<NativeProps>("PortalView", {
  interfaceOnly: true,
});
