#pragma once

#include "RNTPortalViewState.h"

#include <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <jsi/jsi.h>

namespace facebook::react
{

  JSI_EXPORT extern const char PortalViewComponentName[];

  /*
   * `ShadowNode` for <PortalView> component.
   */
  class PortalViewShadowNode : public ConcreteViewShadowNode<
                                   PortalViewComponentName,
                                   PortalViewProps,
                                   PortalViewEventEmitter,
                                   PortalViewState>
  {
  public:
    using ConcreteViewShadowNode::ConcreteViewShadowNode;

    // Helper method to conditionally set dimensions from host
    void setDimensionsFromHost(Size hostSize) const
    {
      printf("HostSize:: width - %f height - %f\n", hostSize.width, hostSize.height);

      // Only set width if host has width
      if (hostSize.width > 0)
      {
        yogaNode_.style().setDimension(
            yoga::Dimension::Width,
            yoga::StyleSizeLength::points(hostSize.width));
      }

      // Only set height if host has height
      if (hostSize.height > 0)
      {
        yogaNode_.style().setDimension(
            yoga::Dimension::Height,
            yoga::StyleSizeLength::points(hostSize.height));
      }
    }
  };

} // namespace facebook::react
