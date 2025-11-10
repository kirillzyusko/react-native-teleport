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

      // Register this portal in the registry if it has a hostName
      // The actual size/position adjustments will be applied in the commit hook
      if (!props.hostName.empty()) {
        PortalShadowRegistry::getInstance().registerPortal(
            &portalViewShadowNode.getFamily());
      } else {
        // Unregister if hostName is empty (portal is not teleported)
        PortalShadowRegistry::getInstance().unregisterPortal(
            &portalViewShadowNode.getFamily());
      }

      ConcreteComponentDescriptor::adopt(shadowNode);
    }
  };

} // namespace facebook::react
