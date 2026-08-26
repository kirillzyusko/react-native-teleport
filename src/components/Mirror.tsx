import MirrorView from "../views/Mirror";
import type { MirrorProps } from "../types";

const MirrorComponent = (props: MirrorProps) => {
  return <MirrorView {...props} />;
};

export default MirrorComponent;
