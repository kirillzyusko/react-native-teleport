import type { Int32 } from "react-native/Libraries/Types/CodegenTypes";
import { codegenNativeComponent, type ViewProps } from "react-native";

interface NativeProps extends ViewProps {
  name?: string;
  hostName?: string;
  order?: Int32;
}

export default codegenNativeComponent<NativeProps>("PortalView", {
  interfaceOnly: true,
});
