#pragma once

#include <react/renderer/core/StateData.h>

namespace facebook::react {

  class MirrorViewState {
   public:
    MirrorViewState() = default;

#ifdef ANDROID
    MirrorViewState(MirrorViewState const &previousState, folly::dynamic data) {}
#endif
  };

} // namespace facebook::react
