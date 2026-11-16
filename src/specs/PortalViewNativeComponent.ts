import { type ViewProps, codegenNativeComponent } from "react-native";

interface NativeProps extends ViewProps {
  name?: string;
  hostName?: string;
}

export default codegenNativeComponent<NativeProps>("PortalView", {
  interfaceOnly: true,
});
