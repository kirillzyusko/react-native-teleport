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
        const LayoutableShadowNode *host =
            PortalShadowRegistry::getInstance().getHost(props.hostName);

        if (host) {
          // Cast to YogaLayoutableShadowNode to access yoga-specific methods
          auto &yogaPortal = static_cast<YogaLayoutableShadowNode &>(portalViewShadowNode);
          auto *yogaHost = dynamic_cast<const YogaLayoutableShadowNode *>(host);

          if (yogaHost) {
            // Get the host's layout metrics
            auto hostLayoutMetrics = yogaHost->getLayoutMetrics();

            printf("Host - width: %f height %f\n", hostLayoutMetrics.frame.size.width, hostLayoutMetrics.frame.size.height);

            if (hostLayoutMetrics.frame.size.width > 0) {
              // Make the portal view take the full size of the host
              // This allows children with `flex` to properly expand
              yogaPortal.setSize(Size{
                .width = hostLayoutMetrics.frame.size.width,
                .height = hostLayoutMetrics.frame.size.height});
            }

            // Set position to absolute so it doesn't affect host's layout
            // and "removes" a view from its current node (to match web spec)
            yogaPortal.setPositionType(YGPositionTypeAbsolute);
          }
        }
      }

      ConcreteComponentDescriptor::adopt(shadowNode);
    }
  };

} // namespace facebook::react
