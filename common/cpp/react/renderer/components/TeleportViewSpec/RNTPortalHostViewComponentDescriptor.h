#pragma once

#include "RNTPortalHostViewShadowNode.h"
#include "PortalShadowRegistry.h"

#include <react/debug/react_native_assert.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

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
        PortalShadowRegistry::getInstance().registerHost(
            props.name,
            &static_cast<const LayoutableShadowNode &>(portalHostViewShadowNode));
      }

      ConcreteComponentDescriptor::adopt(shadowNode);
    }
  };

} // namespace facebook::react
