import { codegenNativeComponent, type ViewProps } from "react-native";

interface NativeProps extends ViewProps {
  name?: string;
  fullScreen?: boolean;
}

export default codegenNativeComponent<NativeProps>("PortalHostView", {
  interfaceOnly: true,
});
