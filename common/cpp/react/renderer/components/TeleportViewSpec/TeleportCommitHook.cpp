//
//  TeleportCommitHook.cpp
//  Pods
//
//  Created by Kiryl Ziusko on 07/10/2025.
//

#include "TeleportCommitHook.h"

using namespace facebook::react;

namespace teleport {

TeleportCommitHook::TeleportCommitHook(const std::shared_ptr<UIManager> &uiManager) : uiManager_(uiManager) {
  uiManager_->registerCommitHook(*this);
}

TeleportCommitHook::~TeleportCommitHook() noexcept {
  uiManager_->unregisterCommitHook(*this);
}

RootShadowNode::Unshared TeleportCommitHook::shadowTreeWillCommit(
    ShadowTree const &,
    RootShadowNode::Shared const &,
    RootShadowNode::Unshared const &newRootShadowNode) noexcept {
  auto rootNode = newRootShadowNode->ShadowNode::clone(ShadowNodeFragment{});
  
  return std::static_pointer_cast<RootShadowNode>(rootNode);
}

}
