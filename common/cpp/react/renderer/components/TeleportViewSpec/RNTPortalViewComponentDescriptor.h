#pragma once

#include "RNTPortalViewShadowNode.h"
#include "PortalShadowRegistry.h"

#include <react/debug/react_native_assert.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <react/renderer/components/view/YogaLayoutableShadowNode.h>

namespace facebook::react {

  class PortalViewComponentDescriptor final
      : public ConcreteComponentDescriptor<PortalViewShadowNode> {
   public:
    using ConcreteComponentDescriptor::ConcreteComponentDescriptor;

    void adopt(ShadowNode &shadowNode) const override {
      react_native_assert(dynamic_cast<PortalViewShadowNode *>(&shadowNode));

      auto &portalViewShadowNode = static_cast<PortalViewShadowNode &>(shadowNode);
      auto &props = static_cast<const PortalViewProps &>(*portalViewShadowNode.getProps());

      // If this portal is teleported to a host, apply the host's layout constraints
      if (!props.hostName.empty()) {
        auto &yogaPortal = static_cast<YogaLayoutableShadowNode &>(portalViewShadowNode);

        // Set position to absolute because:
        // - when the view is teleported, we need to "free" its original space
        // - we need to stretch the view beyond the parent layout constraints
        yogaPortal.setPositionType(YGPositionTypeAbsolute);

        const auto &stateData =
            static_cast<const PortalViewShadowNode::ConcreteState &>(
                *portalViewShadowNode.getState())
                .getData();

        // Native state tracks the destination host after it re-layouts (for
        // example, on rotation). The registry is the initial-layout fallback.
        HostSize hostSize{
            static_cast<float>(stateData.hostWidth),
            static_cast<float>(stateData.hostHeight)};
        if (hostSize.width == 0 || hostSize.height == 0) {
          hostSize = PortalShadowRegistry::getInstance().getHostSize(props.hostName);
        }

        portalViewShadowNode.setDimensionsFromHost(hostSize);
      }

      ConcreteComponentDescriptor::adopt(shadowNode);
    }
  };

} // namespace facebook::react
