import MirrorViewNativeComponent from "../../specs/MirrorViewNativeComponent";
import type { MirrorProps } from "../../types";

const Mirror = (props: MirrorProps) => {
  return <MirrorViewNativeComponent pointerEvents="none" {...props} />;
};

export default Mirror;
