import MirrorView from "../views/Mirror";
import type { MirrorProps } from "../types";

const Mirror = ({ name, mode = "layer", style }: MirrorProps) => {
  return <MirrorView name={name} mode={mode} style={style} />;
};

export default Mirror;
