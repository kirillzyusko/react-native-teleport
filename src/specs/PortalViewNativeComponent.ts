import { codegenNativeComponent, type ViewProps } from "react-native";

interface NativeProps extends ViewProps {
  name?: string;
  hostName?: string;
}

export default codegenNativeComponent<NativeProps>("PortalView", {
  interfaceOnly: true,
});
