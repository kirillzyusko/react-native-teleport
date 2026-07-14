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
        Float offsetX_,
        Float offsetY_)
        : hostWidth(hostWidth_),
          hostHeight(hostHeight_),
          offsetX(offsetX_),
          offsetY(offsetY_) {}

#ifdef ANDROID
    PortalViewState(PortalViewState const &previousState, folly::dynamic data)
        : hostWidth((Float)data["hostWidth"].getDouble()),
          hostHeight((Float)data["hostHeight"].getDouble()),
          offsetX((Float)data["offsetX"].getDouble()),
          offsetY((Float)data["offsetY"].getDouble()) {}

    folly::dynamic getDynamic() const {
      return folly::dynamic::object("hostWidth", hostWidth)(
          "hostHeight", hostHeight)("offsetX", offsetX)("offsetY", offsetY);
    }
#endif

    Float hostWidth{0};
    Float hostHeight{0};
    Float offsetX{0};
    Float offsetY{0};
  };

} // namespace facebook::react
