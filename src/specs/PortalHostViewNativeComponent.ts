import { codegenNativeComponent, type ViewProps } from "react-native";

interface NativeProps extends ViewProps {
  name?: string;
}

export default codegenNativeComponent<NativeProps>("PortalHostView");
