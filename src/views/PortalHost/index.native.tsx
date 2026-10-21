import PortalHostNativeComponent from "../../specs/PortalHostViewNativeComponent";
import type { PortalHostProps } from "../../types/index.native";

const PortalHost = (props: PortalHostProps) => {
  return <PortalHostNativeComponent pointerEvents="box-none" {...props} />;
};

export default PortalHost;
