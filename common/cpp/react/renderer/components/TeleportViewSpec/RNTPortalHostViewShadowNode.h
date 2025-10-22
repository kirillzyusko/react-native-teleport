#pragma once

#include "RNTPortalHostViewState.h"

#include <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <jsi/jsi.h>
#include <cstdio>

namespace facebook::react
{

  JSI_EXPORT extern const char PortalHostViewComponentName[];

  /*
   * `ShadowNode` for <PortalHostView> component.
   */
  class PortalHostViewShadowNode : public ConcreteViewShadowNode<
                                       PortalHostViewComponentName,
                                       PortalHostViewProps,
                                       PortalHostViewEventEmitter,
                                       PortalHostViewState>
  {
  public:
    using ConcreteViewShadowNode::ConcreteViewShadowNode;

    // Get the size of this host's parent node
    // This is used when the host itself hasn't laid out yet (0x0)
    Size getParentSize() const
    {
      Size parentSize{0, 0};

      // Access the protected yogaNode_ member (we're inside the class)
      auto *parentNode = yogaNode_.getOwner();
      if (parentNode)
      {
        auto &parentLayout = parentNode->getLayout();
        parentSize.width = parentLayout.dimension(yoga::Dimension::Width);
        parentSize.height = parentLayout.dimension(yoga::Dimension::Height);

        printf("[PortalHost] getParentSize() - Host's parent size: %.2fx%.2f\n",
               parentSize.width, parentSize.height);
      }
      else
      {
        printf("[PortalHost] getParentSize() - No parent node found\n");
      }

      return parentSize;
    }
  };

} // namespace facebook::react
