import MirrorView from "../views/Mirror";
import type { MirrorProps } from "../types";

const MirrorComponent = ({
  hidesSourceView = false,
  matchesAlpha = true,
  matchesTransform = false,
  matchesPosition = false,
  ...props
}: MirrorProps) => {
  return (
    <MirrorView
      hidesSourceView={hidesSourceView}
      matchesAlpha={matchesAlpha}
      matchesTransform={matchesTransform}
      matchesPosition={matchesPosition}
      {...props}
    />
  );
};

export default MirrorComponent;
