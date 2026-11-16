#pragma once

#include <react/renderer/graphics/Float.h>

#ifdef ANDROID
#include <folly/dynamic.h>
#endif

namespace facebook::react {

  class PortalViewState {
   public:
    PortalViewState() = default;
    PortalViewState(
        Float hostWidth_,
        Float hostHeight_,
        int hostTag_)
        : hostWidth(hostWidth_),
          hostHeight(hostHeight_),
          hostTag(hostTag_) {}

#ifdef ANDROID
    PortalViewState(PortalViewState const &previousState, folly::dynamic data)
        : hostWidth((Float)data["hostWidth"].getDouble()),
          hostHeight((Float)data["hostHeight"].getDouble()),
          hostTag(static_cast<int>(data["hostTag"].asInt())) {}

    folly::dynamic getDynamic() const {
      return folly::dynamic::object("hostWidth", hostWidth)(
          "hostHeight", hostHeight)("hostTag", hostTag);
    }
#endif

    Float hostWidth{0};
    Float hostHeight{0};
    // React tag of the `PortalHostView` the children are mounted into.
    // `0` means that the children are rendered in place.
    int hostTag{0};
  };

} // namespace facebook::react
