#pragma once

#include "RNTPortalViewState.h"
#include "PortalShadowRegistry.h"

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

    // Helper method to conditionally set dimensions from host
    void setDimensionsFromHost(HostSize hostSize) const {
      // printf("HostSize:: width - %f height - %f\n", hostSize.width, hostSize.height);

      if (hostSize.width != 0 && hostSize.height != 0) {
        setSize(Size(hostSize.width, hostSize.height));
      }
    }

    void setDimensionsFromState(PortalViewState state) const {
      if (state.hasHostLayout && state.width != 0 && state.height != 0) {
        setSize(Size(state.width, state.height));
      }
    }

    Transform getTransform() const override {
      auto transform = ConcreteViewShadowNode::getTransform();
      const auto &stateData =
          static_cast<const PortalViewShadowNode::ConcreteState &>(*getState())
              .getData();

      if (!stateData.hasHostLayout) {
        return transform;
      }

      return transform * Transform::Translate(stateData.offsetX, stateData.offsetY, 0);
    }
  };

} // namespace facebook::react
