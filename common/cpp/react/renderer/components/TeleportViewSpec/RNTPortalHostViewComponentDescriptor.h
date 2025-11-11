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
      ConcreteComponentDescriptor::adopt(shadowNode);
    }
  };

} // namespace facebook::react
