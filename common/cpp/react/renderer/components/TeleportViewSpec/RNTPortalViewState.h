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
        Float width_,
        Float height_,
        Float offsetX_,
        Float offsetY_)
        : width(width_),
          height(height_),
          offsetX(offsetX_),
          offsetY(offsetY_),
          hasHostLayout(true) {}

#ifdef ANDROID
    PortalViewState(PortalViewState const &previousState, folly::dynamic data)
        : width((Float)data["width"].getDouble()),
          height((Float)data["height"].getDouble()),
          offsetX((Float)data["offsetX"].getDouble()),
          offsetY((Float)data["offsetY"].getDouble()),
          hasHostLayout(data["hasHostLayout"].getBool()) {}

    folly::dynamic getDynamic() const {
      return folly::dynamic::object("width", width)("height", height)(
          "offsetX", offsetX)("offsetY", offsetY)(
          "hasHostLayout", hasHostLayout);
    }
#endif

    Float width{0};
    Float height{0};
    Float offsetX{0};
    Float offsetY{0};
    bool hasHostLayout{false};
  };

} // namespace facebook::react
