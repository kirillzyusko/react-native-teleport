#pragma once

#ifdef ANDROID
#include <folly/dynamic.h>
#endif

namespace facebook::react {

  class MirrorViewState {
   public:
    MirrorViewState() = default;

#ifdef ANDROID
    MirrorViewState(MirrorViewState const &previousState, folly::dynamic data) {}
    folly::dynamic getDynamic() const {
      return {};
    }
#endif
  };

} // namespace facebook::react
