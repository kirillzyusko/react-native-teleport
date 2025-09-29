module.exports = {
  dependency: {
    platforms: {
      android: {
        componentDescriptors: [
          "PortalViewComponentDescriptor",
          "PortalHostViewComponentDescriptor",
        ],
        cmakeListsPath: "../android/src/main/jni/CMakeLists.txt",
      },
    },
  },
};
