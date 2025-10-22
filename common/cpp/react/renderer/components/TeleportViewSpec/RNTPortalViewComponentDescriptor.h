#pragma once

#include "RNTPortalViewShadowNode.h"
#include "PortalShadowRegistry.h"

#include <react/debug/react_native_assert.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <react/renderer/components/view/YogaLayoutableShadowNode.h>
#include <cstdio>

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
        printf("[PortalViewDescriptor] adopt() called for portal with hostName: %s\n",
               props.hostName.c_str());

        const LayoutableShadowNode *host =
            PortalShadowRegistry::getInstance().getHost(props.hostName);

        if (host)
        {
          printf("[PortalViewDescriptor] Host found in registry\n");

          // Cast to YogaLayoutableShadowNode to access yoga-specific methods
          auto &yogaPortal = static_cast<YogaLayoutableShadowNode &>(portalViewShadowNode);

          // Set position to absolute so the portal doesn't affect host's layout flow
          yogaPortal.setPositionType(YGPositionTypeAbsolute);
          printf("[PortalViewDescriptor] Set portal position to absolute\n");

          // Apply the host's size (or portal's parent's size if host is 0x0) to the portal
          // This breaks the portal out of its original parent's constraints
          portalViewShadowNode.setHostSizeFromParent(host);
        }
        else
        {
          printf("[PortalViewDescriptor] Host NOT found in registry for name: %s\n",
                 props.hostName.c_str());
        }
      }
      else
      {
        printf("[PortalViewDescriptor] adopt() called but hostName is empty\n");
      }

      ConcreteComponentDescriptor::adopt(shadowNode);
    }
  };

} // namespace facebook::react
