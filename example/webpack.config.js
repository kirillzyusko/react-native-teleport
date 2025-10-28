const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const appDirectory = path.resolve(__dirname);
const { presets, plugins } = require(`${appDirectory}/babel.config.js`);
const compileNodeModules = [
  "react-native-worklets",
  "react-native-reanimated",
  "react-native-gesture-handler",
  "react-native-screens",
  "react-native-safe-area-context",
  "@react-navigation/native",
  "@react-navigation/elements",
  "@react-navigation/native-stack",
].map((moduleName) => path.resolve(appDirectory, `node_modules/${moduleName}`));

const teleportSrc = path.resolve(__dirname, "..", "src");
const babelLoaderConfiguration = {
  test: /\.(js|jsx|ts|tsx)$/, // Updated to include .jsx
  // Add every directory that needs to be compiled by Babel during the build.
  include: [
    path.resolve(__dirname, "index.web.js"), // Entry to your application
    path.resolve(__dirname, "src", "App.tsx"), // Updated to .jsx
    path.resolve(__dirname, "src"),
    path.resolve(__dirname, "component"),
    teleportSrc,
    ...compileNodeModules,
  ],
  use: {
    loader: "babel-loader",
    options: {
      cacheDirectory: true,
      presets,
      plugins,
    },
  },
  type: "javascript/auto",
};

const svgLoaderConfiguration = {
  test: /\.svg$/,
  use: [
    {
      loader: "@svgr/webpack",
    },
  ],
};

const imageLoaderConfiguration = {
  test: /\.(gif|jpe?g|png|svg)$/,
  use: {
    loader: "url-loader",
    options: {
      name: "[name].[ext]",
    },
  },
};
const videoLoaderConfiguration = {
  test: /\.(mp4|mov|webm)$/,
  type: "asset/resource",
  generator: {
    filename: "media/[name][ext]",
  },
};

module.exports = {
  ignoreWarnings: [
    {
      // worklet is a new library, so let's simply ignore it :)
      module: /react-native-worklets[\\/]/,
      message: /Critical dependency: require function is used in a way/,
    },
  ],
  entry: {
    app: path.join(__dirname, "index.web.js"),
  },
  output: {
    path: path.resolve(appDirectory, "dist"),
    publicPath: "/",
    filename: "rnw.bundle.js",
  },
  resolve: {
    extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".web.js", ".js"],
    alias: {
      "react-native$": "react-native-web",
      "react-native-teleport": teleportSrc,
      "react": path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
  },
  module: {
    rules: [
      babelLoaderConfiguration,
      imageLoaderConfiguration,
      svgLoaderConfiguration,
      videoLoaderConfiguration,
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "index.html"),
    }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      __DEV__: JSON.stringify(true),
    }),
    new webpack.EnvironmentPlugin({ JEST_WORKER_ID: null }),
    new webpack.DefinePlugin({ process: { env: {} } }),
  ],
};
