#pragma once

#include "RNTPortalViewShadowNode.h"
#include "PortalShadowRegistry.h"

#include <react/debug/react_native_assert.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <react/renderer/components/view/YogaLayoutableShadowNode.h>

namespace facebook::react
{

  class PortalViewComponentDescriptor final
      : public ConcreteComponentDescriptor<PortalViewShadowNode>
  {
  public:
    using ConcreteComponentDescriptor::ConcreteComponentDescriptor;

    void adopt(ShadowNode &shadowNode) const override
    {
      react_native_assert(dynamic_cast<PortalViewShadowNode *>(&shadowNode));

      auto &portalViewShadowNode = static_cast<PortalViewShadowNode &>(shadowNode);
      auto &props = static_cast<const PortalViewProps &>(*portalViewShadowNode.getProps());

      // If this portal is teleported to a host, apply the host's layout constraints
      if (!props.hostName.empty())
      {
        const LayoutableShadowNode *host =
            PortalShadowRegistry::getInstance().getHost(props.hostName);

        if (host)
        {
          // Cast to YogaLayoutableShadowNode to access yoga-specific methods
          auto &yogaPortal = static_cast<YogaLayoutableShadowNode &>(portalViewShadowNode);

          // Set position to absolute so the portal doesn't affect host's layout flow
          yogaPortal.setPositionType(YGPositionTypeAbsolute);

          // Get the host's current layout size
          auto hostLayoutMetrics = host->getLayoutMetrics();

          // Conditionally set dimensions: only set width if > 0, only set height if > 0
          portalViewShadowNode.setDimensionsFromHost(hostLayoutMetrics.frame.size);
        }
      }

      ConcreteComponentDescriptor::adopt(shadowNode);
    }
  };

} // namespace facebook::react
