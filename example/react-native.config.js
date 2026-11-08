const path = require("path");
const pkg = require("../package.json");
const spmOnly = process.env.TELEPORT_SPM_ONLY === "1";
const disabledIOSDependencies = spmOnly
  ? Object.fromEntries(
      Object.keys(require("./package.json").dependencies)
        .filter((name) => name !== "react-native")
        .map((name) => [name, { platforms: { ios: null } }]),
    )
  : {};

module.exports = {
  project: {
    ios: {
      automaticPodsInstallation: !spmOnly,
    },
  },
  dependencies: {
    ...disabledIOSDependencies,
    [pkg.name]: {
      root: path.join(__dirname, ".."),
      platforms: {
        // Codegen script incorrectly fails without this
        // So we explicitly specify the platforms with empty object
        ios: {},
        android: {},
      },
    },
  },
  assets: ["./assets/fonts"],
};
