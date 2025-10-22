#pragma once

#include "RNTPortalViewState.h"
#include "RNTPortalHostViewShadowNode.h"

#include <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <jsi/jsi.h>
#include <cstdio>

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

    // Helper method to set the portal size to match the host
    // If host hasn't laid out yet, get size from the host's parent yoga node
    void setHostSizeFromParent(const LayoutableShadowNode *host) const
    {
      Size targetSize{0, 0};

      // First, try to get the host's current layout size
      if (host)
      {
        auto hostLayoutMetrics = host->getLayoutMetrics();
        targetSize = hostLayoutMetrics.frame.size;

        printf("[Portal] Host's current layout size: %.2fx%.2f\n",
               targetSize.width, targetSize.height);

        // If host hasn't laid out yet (size is 0x0), try to get the HOST'S parent size
        if (targetSize.width <= 0 || targetSize.height <= 0)
        {
          printf("[Portal] Host size is 0x0, falling back to host's parent\n");

          // Cast to PortalHostViewShadowNode to access its getParentSize() method
          // which can access the protected yogaNode_ member
          auto *portalHostNode = dynamic_cast<const PortalHostViewShadowNode *>(host);
          if (portalHostNode)
          {
            targetSize = portalHostNode->getParentSize();

            printf("[Portal] Using host's parent size: %.2fx%.2f\n",
                   targetSize.width, targetSize.height);
          }
          else
          {
            printf("[Portal] Failed to cast host to PortalHostViewShadowNode\n");
          }
        }
        else
        {
          printf("[Portal] Using host's layout size directly\n");
        }
      }
      else
      {
        printf("[Portal] No host provided to setHostSizeFromParent\n");
      }

      // Apply the target size to the portal
      if (targetSize.width > 0 && targetSize.height > 0)
      {
        printf("[Portal] Applying dimensions to portal: %.2fx%.2f\n",
               targetSize.width, targetSize.height);

        yogaNode_.style().setDimension(
            yoga::Dimension::Width, yoga::StyleSizeLength::points(targetSize.width));
        yogaNode_.style().setDimension(
            yoga::Dimension::Height, yoga::StyleSizeLength::points(targetSize.height));
      }
      else
      {
        printf("[Portal] Target size is 0x0, not applying dimensions\n");
      }
    }
  };

} // namespace facebook::react
