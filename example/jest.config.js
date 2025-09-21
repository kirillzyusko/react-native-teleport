module.exports = {
  preset: "react-native",
  setupFiles: ["./jestSetup.js"],
  moduleNameMapper: {
    "^react-native-teleport$": "<rootDir>/../src/index.ts",
    "^react-native-teleport/jest$": "<rootDir>/../jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@react-native|react-native|react-native-teleport)/)",
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
