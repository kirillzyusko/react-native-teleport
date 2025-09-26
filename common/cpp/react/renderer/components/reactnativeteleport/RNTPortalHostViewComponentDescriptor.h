#pragma once

#include "RNTPortalHostViewShadowNode.h"
#include "PortalShadowRegistry.h"

#include <react/debug/react_native_assert.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {

class PortalHostViewComponentDescriptor final
    : public ConcreteComponentDescriptor<PortalHostViewShadowNode> {
 public:
  using ConcreteComponentDescriptor::ConcreteComponentDescriptor;

  void adopt(ShadowNode &shadowNode) const override {
    react_native_assert(dynamic_cast<PortalHostViewShadowNode *>(&shadowNode));
    
    auto& hostShadowNode = static_cast<PortalHostViewShadowNode&>(shadowNode);
    auto name = std::static_pointer_cast<const PortalHostViewProps>(hostShadowNode.getProps())->name;

    if (!name.empty()) {
      auto sharedHost = hostShadowNode.shared_from_this();
      PortalShadowRegistry::shared().registerHost(name, sharedHost);
    }
    
    ConcreteComponentDescriptor::adopt(shadowNode);
  }
};

} // namespace facebook::react
