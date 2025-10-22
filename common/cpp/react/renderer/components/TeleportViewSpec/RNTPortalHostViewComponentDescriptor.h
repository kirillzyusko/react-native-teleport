#pragma once

#include "RNTPortalHostViewShadowNode.h"
#include "PortalShadowRegistry.h"

#include <react/debug/react_native_assert.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <cstdio>

namespace facebook::react
{

  class PortalHostViewComponentDescriptor final
      : public ConcreteComponentDescriptor<PortalHostViewShadowNode>
  {
  public:
    using ConcreteComponentDescriptor::ConcreteComponentDescriptor;

    void adopt(ShadowNode &shadowNode) const override
    {
      react_native_assert(dynamic_cast<PortalHostViewShadowNode *>(&shadowNode));

      auto &portalHostViewShadowNode = static_cast<PortalHostViewShadowNode &>(shadowNode);
      auto &props = static_cast<const PortalHostViewProps &>(*portalHostViewShadowNode.getProps());

      // Register this host in the portal shadow registry
      if (!props.name.empty())
      {
        printf("[PortalHostViewDescriptor] adopt() called, registering host with name: %s\n",
               props.name.c_str());

        const auto &layoutableNode = static_cast<const LayoutableShadowNode &>(portalHostViewShadowNode);

        // Log the host's current layout size
        auto hostLayoutMetrics = layoutableNode.getLayoutMetrics();
        printf("[PortalHostViewDescriptor] Host's current size: %.2fx%.2f\n",
               hostLayoutMetrics.frame.size.width, hostLayoutMetrics.frame.size.height);

        PortalShadowRegistry::getInstance().registerHost(
            props.name,
            &layoutableNode);

        printf("[PortalHostViewDescriptor] Host registered in registry\n");
      }
      else
      {
        printf("[PortalHostViewDescriptor] adopt() called but name is empty\n");
      }

      ConcreteComponentDescriptor::adopt(shadowNode);
    }
  };

} // namespace facebook::react
