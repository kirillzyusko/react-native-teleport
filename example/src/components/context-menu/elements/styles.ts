import { commonStyle } from "../../../../styles/common";
import { createStyle } from "../../../../styles/utils";

////////////////////////////////////////////////////////////////////////////////

const styles = createStyle({
  text: commonStyle.bodyLabel,
  container: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

////////////////////////////////////////////////////////////////////////////////

export default styles;
