#pragma once

#include "RNTPortalHostViewState.h"
#include "PortalShadowRegistry.h"

#include <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/core/LayoutContext.h>
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

    void layout(LayoutContext layoutContext) override {
      ConcreteViewShadowNode::layout(layoutContext);

      // After layout is complete, update the size in the registry
      auto &props = static_cast<const PortalHostViewProps &>(*getProps());
      if (!props.name.empty()) {
        auto layoutMetrics = getLayoutMetrics();
        PortalShadowRegistry::getInstance().updateHostSize(
            props.name,
            layoutMetrics.frame.size);
      }
    }
  };

} // namespace facebook::react
