#pragma once

#include "RNTPortalViewState.h"

#include <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <jsi/jsi.h>

namespace facebook::react {

  JSI_EXPORT extern const char PortalViewComponentName[];

  /*
   * `ShadowNode` for <PortalView> component.
   */
  class PortalViewShadowNode : public ConcreteViewShadowNode<
      PortalViewComponentName,
      PortalViewProps,
      PortalViewEventEmitter,
      PortalViewState> {
   public:
    using ConcreteViewShadowNode::ConcreteViewShadowNode;
  };

} // namespace facebook::react
