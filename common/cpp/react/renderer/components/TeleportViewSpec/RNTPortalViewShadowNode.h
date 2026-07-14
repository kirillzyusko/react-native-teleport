#pragma once

#include "RNTPortalViewState.h"

#include <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/graphics/Transform.h>
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

    Transform getTransform() const override {
      auto transform = ConcreteViewShadowNode::getTransform();
      auto &props = static_cast<const PortalViewProps &>(*getProps());
      if (props.hostName.empty()) {
        return transform;
      }

      const auto &stateData =
          static_cast<const PortalViewShadowNode::ConcreteState &>(*getState())
              .getData();

      return transform * Transform::Translate(stateData.offsetX, stateData.offsetY, 0);
    }
  };

} // namespace facebook::react
