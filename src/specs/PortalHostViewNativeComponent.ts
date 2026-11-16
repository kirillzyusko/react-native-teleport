import { type ViewProps, codegenNativeComponent } from "react-native";

interface NativeProps extends ViewProps {
  name?: string;
}

export default codegenNativeComponent<NativeProps>("PortalHostView", {
  interfaceOnly: true,
});
