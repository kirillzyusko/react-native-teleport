#pragma once

#include "RNTPortalHostViewState.h"

#include <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <jsi/jsi.h>

namespace facebook::react {

  JSI_EXPORT extern const char PortalHostViewComponentName[];

  /*
   * `ShadowNode` for <PortalHostView> component.
   */
  class PortalHostViewShadowNode : public ConcreteViewShadowNode<
                                       PortalHostViewComponentName,
                                       PortalHostViewProps,
                                       PortalHostViewEventEmitter,
                                       PortalHostViewState> {
   public:
    using ConcreteViewShadowNode::ConcreteViewShadowNode;
  };

} // namespace facebook::react
