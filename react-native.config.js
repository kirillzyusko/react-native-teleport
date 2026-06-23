module.exports = {
  dependency: {
    platforms: {
      android: {
        componentDescriptors: [
          "PortalViewComponentDescriptor",
          "PortalHostViewComponentDescriptor",
          "MirrorViewComponentDescriptor",
        ],
        cmakeListsPath: "../android/src/main/jni/CMakeLists.txt",
      },
    },
  },
};
