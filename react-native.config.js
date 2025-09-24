module.exports = {
  dependency: {
    platforms: {
      android: {
        componentDescriptors: [
          "PortalViewComponentDescriptor",
          "PortalHostComponentDescriptor",
        ],
        cmakeListsPath: "../android/src/main/jni/CMakeLists.txt",
      },
    },
  },
};
