#pragma once

#ifdef ANDROID
#include <folly/dynamic.h>
#endif

namespace facebook::react
{

  class PortalHostViewState
  {
  public:
    PortalHostViewState() = default;

#ifdef ANDROID
    PortalHostViewState(PortalHostViewState const &previousState, folly::dynamic data) {}
    folly::dynamic getDynamic() const
    {
      return {};
    }
#endif
  };

} // namespace facebook::react