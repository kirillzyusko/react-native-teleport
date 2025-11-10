//
//  TeleportCommitHook.cpp
//  Pods
//
//  Created by Kiryl Ziusko on 07/10/2025.
//

#include "TeleportCommitHook.h"
#include "RNTPortalViewShadowNode.h"
#include <react/renderer/components/view/YogaLayoutableShadowNode.h>

using namespace facebook::react;

namespace teleport
{

  TeleportCommitHook::TeleportCommitHook(const std::shared_ptr<UIManager> &uiManager) : uiManager_(uiManager)
  {
    uiManager_->registerCommitHook(*this);
  }

  TeleportCommitHook::~TeleportCommitHook() noexcept
  {
    uiManager_->unregisterCommitHook(*this);
  }

  RootShadowNode::Unshared TeleportCommitHook::shadowTreeWillCommit(
      ShadowTree const &,
      RootShadowNode::Shared const &oldRootShadowNode,
      RootShadowNode::Unshared const &newRootShadowNode) noexcept
  {
    // Start with the new root
    auto rootNode = newRootShadowNode;

    // Get all registered portal families
    auto portalFamilies = PortalShadowRegistry::getInstance().getPortalFamilies();

    // Iterate over each portal that needs size/position adjustment
    for (const auto family : portalFamilies)
    {
      auto newRoot = rootNode->cloneTree(
          *family,
          [](ShadowNode const &oldShadowNode)
          {
            // Clone the node
            auto clone = oldShadowNode.clone({});

            // We know this is a PortalViewShadowNode because we registered it as such
            // Use static_cast to avoid RTTI issues across shared libraries on Android
            auto &props = static_cast<const PortalViewProps &>(*clone->getProps());

            // If this portal has a hostName, apply size and position
            if (!props.hostName.empty())
            {
              auto host = PortalShadowRegistry::getInstance().getHost(props.hostName);

              if (host)
              {
                auto hostLayoutMetrics = host->getLayoutMetrics();
                auto hostSize = hostLayoutMetrics.frame.size;

                // Cast to YogaLayoutableShadowNode to manipulate layout
                // This is safe because PortalViewShadowNode extends ConcreteViewShadowNode
                // which extends YogaLayoutableShadowNode
                auto layoutableNode = std::static_pointer_cast<YogaLayoutableShadowNode>(clone);

                // Set position to absolute to free the original space
                layoutableNode->setPositionType(YGPositionTypeAbsolute);

                // Only apply if host has valid (non-zero) size
                if (hostSize.width > 0 && hostSize.height > 0)
                {
                  // Set size to match the host
                  layoutableNode->setSize(hostSize);
                }
              }
            }

            return clone;
          });

      if (newRoot)
      {
        rootNode = std::static_pointer_cast<RootShadowNode>(newRoot);
      }
    }

    return std::const_pointer_cast<RootShadowNode>(rootNode);
  }

}
