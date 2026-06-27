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
        Float offsetX_,
        Float offsetY_)
        : offsetX(offsetX_), offsetY(offsetY_) {}

#ifdef ANDROID
    PortalViewState(PortalViewState const &previousState, folly::dynamic data)
        : offsetX((Float)data["offsetX"].getDouble()),
          offsetY((Float)data["offsetY"].getDouble()) {}

    folly::dynamic getDynamic() const {
      return folly::dynamic::object("offsetX", offsetX)("offsetY", offsetY);
    }
#endif

    Float offsetX{0};
    Float offsetY{0};
  };

} // namespace facebook::react
