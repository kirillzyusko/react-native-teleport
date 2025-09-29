#pragma once

#ifdef ANDROID
#include <folly/dynamic.h>
#endif

namespace facebook::react {

  class PortalViewState {
   public:
    PortalViewState() = default;

#ifdef ANDROID
    PortalViewState(PortalViewState const &previousState, folly::dynamic data) {}
    folly::dynamic getDynamic() const {
      return {};
    }
#endif
  };

} // namespace facebook::react
