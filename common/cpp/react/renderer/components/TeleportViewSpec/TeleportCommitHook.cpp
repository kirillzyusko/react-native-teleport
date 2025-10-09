//
//  TeleportCommitHook.cpp
//  Pods
//
//  Created by Kiryl Ziusko on 07/10/2025.
//

#include "TeleportCommitHook.h"

using namespace facebook::react;

namespace teleport {

ShadowNode::Shared deepClone(const ShadowNode::Shared &node) {
  if (!node) return nullptr;

  std::vector<ShadowNode::Shared> newChildren;
  for (const auto &child : node->getChildren()) {
    newChildren.push_back(deepClone(child));
  }

  auto cloned = node->clone(ShadowNodeFragment{
      .children = std::make_shared<const std::vector<ShadowNode::Shared>>(std::move(newChildren))});
  return std::static_pointer_cast<const ShadowNode>(cloned);
}

TeleportCommitHook::TeleportCommitHook(const std::shared_ptr<UIManager> &uiManager) : uiManager_(uiManager) {
  uiManager_->registerCommitHook(*this);
}

TeleportCommitHook::~TeleportCommitHook() noexcept {
  uiManager_->unregisterCommitHook(*this);
}

RootShadowNode::Unshared TeleportCommitHook::shadowTreeWillCommit(
    ShadowTree const &shadowTree,
    RootShadowNode::Shared const &oldRootShadowNode,
    RootShadowNode::Unshared const &newRootShadowNode) noexcept {
  auto rootNode = newRootShadowNode;
  auto &registry = PortalShadowRegistry::shared();
  auto hostNames = registry.getActiveHostNames();

  for (const auto &hostName : hostNames) {
    auto host = registry.getHost(hostName);
    if (!host) {
      continue;
    }

    auto portals = registry.getPortals(hostName);
    if (portals.empty()) {
      continue;
    }

    std::vector<ShadowNode::Shared> additionalChildren;

    for (const auto &portal : portals) {
      auto portalChildren = portal->getChildren();
      for (const auto &child : portalChildren) {
        additionalChildren.push_back(deepClone(child));
      }

      // Clear children from the portal (teleporting them away).
      const auto& portalFamily = portal->getFamily();
      rootNode = std::static_pointer_cast<RootShadowNode>(
          rootNode->cloneTree(portalFamily, [](const ShadowNode &oldNode) -> ShadowNode::Unshared {
            return oldNode.clone(ShadowNodeFragment{.children = ShadowNode::emptySharedShadowNodeSharedList()});
          }));
    }

    // Append all collected children to the host.
    const auto& hostFamily = host->getFamily();
    rootNode = std::static_pointer_cast<RootShadowNode>(
        rootNode->cloneTree(hostFamily, [&additionalChildren](const ShadowNode &oldNode) -> ShadowNode::Unshared {
          auto oldChildren = oldNode.getChildren();
          std::vector<ShadowNode::Shared> newChildren(oldChildren.begin(), oldChildren.end());
          newChildren.insert(newChildren.end(), additionalChildren.begin(), additionalChildren.end());
          return oldNode.clone(ShadowNodeFragment{
              .children = std::make_shared<const std::vector<ShadowNode::Shared>>(std::move(newChildren))});
        }));
  }

  return rootNode;
}

}
