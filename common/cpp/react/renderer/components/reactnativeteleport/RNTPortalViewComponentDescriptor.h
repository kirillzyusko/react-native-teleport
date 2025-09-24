#pragma once

#include "RNTPortalViewShadowNode.h"

#include <react/debug/react_native_assert.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {

class PortalViewComponentDescriptor final
    : public ConcreteComponentDescriptor<PortalViewShadowNode> {
 public:
  using ConcreteComponentDescriptor::ConcreteComponentDescriptor;
  void adopt(ShadowNode &shadowNode) const override {
    react_native_assert(dynamic_cast<PortalViewShadowNode *>(&shadowNode));
    ConcreteComponentDescriptor::adopt(shadowNode);
  }
};

} // namespace facebook::react
