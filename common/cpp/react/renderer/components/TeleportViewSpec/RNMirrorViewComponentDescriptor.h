#pragma once

#include "RNMirrorViewShadowNode.h"

#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {

  class MirrorViewComponentDescriptor final
      : public ConcreteComponentDescriptor<MirrorViewShadowNode> {
   public:
    using ConcreteComponentDescriptor::ConcreteComponentDescriptor;
  };

} // namespace facebook::react
